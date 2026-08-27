#!/usr/bin/env bash
# Provisions the real AWS resources kali-quantum-workflow.json needs: an
# SNS topic for approval notifications, an EventBridge Connection for
# authenticating to the Render-hosted validation service, an IAM
# execution role for the state machine, and the state machine itself.
#
# Requires two real values as env vars before running:
#   QUANTUM_SERVICE_REAL_API_KEY  - the actual secret set as
#                                   QUANTUM_SERVICE_API_KEY in the Render
#                                   dashboard for kali-quantum-service
#                                   (NOT the "dev-only" local value in
#                                   .env.local - verified live that the
#                                   deployed service rejects that one).
#   BRAKET_RESULTS_BUCKET         - a real S3 bucket you own in this
#                                   account/region for Braket to write
#                                   task results to.
#
#   QUANTUM_SERVICE_REAL_API_KEY=... BRAKET_RESULTS_BUCKET=... \
#     bash aws/setup-kali-quantum-infra.sh
#
# The state machine definition file itself is never edited in place -
# this script substitutes both values into a temp copy before deploying,
# so the checked-in JSON stays generic/reusable across environments.

set -euo pipefail

: "${QUANTUM_SERVICE_REAL_API_KEY:?Set QUANTUM_SERVICE_REAL_API_KEY to the real Render env var value first.}"
: "${BRAKET_RESULTS_BUCKET:?Set BRAKET_RESULTS_BUCKET to a real S3 bucket name first.}"

# Amazon Braket is only offered in a handful of regions (us-east-1,
# us-west-1, us-west-2, eu-west-2) - us-east-2 is NOT one of them (confirmed
# empirically: its Braket API endpoint doesn't even resolve). Every resource
# below must live in the same Braket-supported region, since Step
# Functions' aws-sdk:braket:createQuantumTask integration always calls
# Braket in the state machine's own execution region - there's no way to
# point just that one step at a different region without a real
# architecture change (e.g. routing through a Lambda with its own
# cross-region client).
REGION="us-east-1"
ACCOUNT_ID="060274391988"
TOPIC_NAME="kali-quantum-approvals"
CONNECTION_NAME="kali-quantum-service-auth"
ROLE_NAME="kali-quantum-workflow-role"
STATE_MACHINE_NAME="kali-quantum-workflow"

echo "==> Confirming this shell is actually authenticated as account ${ACCOUNT_ID}..."
CALLER_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
if [ "$CALLER_ACCOUNT" != "$ACCOUNT_ID" ]; then
  echo "ERROR: this shell is authenticated as account ${CALLER_ACCOUNT}, not ${ACCOUNT_ID}. Aborting." >&2
  exit 1
fi

echo "==> Creating SNS topic '${TOPIC_NAME}' (idempotent — safe to re-run)..."
TOPIC_ARN=$(aws sns create-topic --name "$TOPIC_NAME" --region "$REGION" --query TopicArn --output text)
echo "    ${TOPIC_ARN}"
echo "    Subscribe whoever should receive approval requests, e.g.:"
echo "    aws sns subscribe --topic-arn ${TOPIC_ARN} --protocol email --notification-endpoint you@example.com --region ${REGION}"

echo "==> Creating EventBridge Connection '${CONNECTION_NAME}' (kali-quantum-service.onrender.com's X-API-Key auth)..."
if aws events describe-connection --name "$CONNECTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "    Connection already exists — updating its API key."
  aws events update-connection \
    --name "$CONNECTION_NAME" \
    --authorization-type API_KEY \
    --auth-parameters "{\"ApiKeyAuthParameters\":{\"ApiKeyName\":\"X-API-Key\",\"ApiKeyValue\":\"${QUANTUM_SERVICE_REAL_API_KEY}\"}}" \
    --region "$REGION" >/dev/null
else
  aws events create-connection \
    --name "$CONNECTION_NAME" \
    --authorization-type API_KEY \
    --auth-parameters "{\"ApiKeyAuthParameters\":{\"ApiKeyName\":\"X-API-Key\",\"ApiKeyValue\":\"${QUANTUM_SERVICE_REAL_API_KEY}\"}}" \
    --region "$REGION" >/dev/null
fi
CONNECTION_ARN=$(aws events describe-connection --name "$CONNECTION_NAME" --region "$REGION" --query ConnectionArn --output text)
CONNECTION_SECRET_ARN=$(aws events describe-connection --name "$CONNECTION_NAME" --region "$REGION" --query SecretArn --output text)
echo "    ${CONNECTION_ARN}"

echo "==> Creating IAM execution role '${ROLE_NAME}' for the state machine..."
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "states.${REGION}.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF
)
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document "$TRUST_POLICY" \
  --description "Execution role for the Kali quantum task Step Functions workflow" \
  || echo "    (role may already exist — continuing)"

# create-role only sets the trust policy at creation time - if the role
# already existed (e.g. from a run against a different REGION, as happened
# migrating us-east-2 -> us-east-1), it silently keeps the OLD trust
# principal, and Step Functions fails at AssumeRole with "principal
# states.amazonaws.com is not authorized" since it no longer matches this
# region's service principal. Always re-assert it so the role's trust
# policy can never drift from the region this script is actually deploying
# into.
aws iam update-assume-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-document "$TRUST_POLICY"

PERMISSIONS_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "${TOPIC_ARN}"
    },
    {
      "Effect": "Allow",
      "Action": ["braket:CreateQuantumTask", "braket:GetQuantumTask"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["states:InvokeHTTPEndpoint"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["events:RetrieveConnectionCredentials"],
      "Resource": "${CONNECTION_ARN}"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": "${CONNECTION_SECRET_ARN}"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::${BRAKET_RESULTS_BUCKET}/*"
    }
  ]
}
EOF
)
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "${ROLE_NAME}-permissions" \
  --policy-document "$PERMISSIONS_POLICY"

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
echo "    ${ROLE_ARN}"
echo "    NOTE: IAM roles can take ~10-15 seconds to propagate before Step Functions can assume them."

echo "==> Granting Braket's service-linked role access to ${BRAKET_RESULTS_BUCKET}..."
# Braket writes task results into OutputS3Bucket using ITS OWN backend
# service-linked role (AWSServiceRoleForAmazonBraket), not the workflow's
# own execution role above - an identity-based s3:PutObject grant on that
# role alone isn't enough, since S3 also checks the bucket's own resource
# policy for access from a different principal. Without this, real task
# submission fails with "Caller doesn't have access to bucket or it
# doesn't exist" even though the bucket exists and the workflow role can
# otherwise write to it directly.
aws iam create-service-linked-role --aws-service-name braket.amazonaws.com 2>/dev/null \
  || echo "    (service-linked role already exists — continuing)"
BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AmazonBraketServiceLinkedRoleAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${ACCOUNT_ID}:role/aws-service-role/braket.amazonaws.com/AWSServiceRoleForAmazonBraket"
      },
      "Action": ["s3:PutObject", "s3:GetObject", "s3:GetBucketLocation", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::${BRAKET_RESULTS_BUCKET}",
        "arn:aws:s3:::${BRAKET_RESULTS_BUCKET}/*"
      ]
    }
  ]
}
EOF
)
aws s3api put-bucket-policy --bucket "$BRAKET_RESULTS_BUCKET" --policy "$BUCKET_POLICY"

echo "==> Preparing the state machine definition (substituting the connection ARN + SNS topic ARN + S3 bucket into a temp copy)..."
SOURCE_DEFINITION="$(dirname "$0")/step-functions/kali-quantum-workflow.json"
TMP_DEFINITION=$(mktemp)
trap 'rm -f "$TMP_DEFINITION"' EXIT
sed \
  -e "s|__EVENTBRIDGE_CONNECTION_ARN__|${CONNECTION_ARN}|g" \
  -e "s|__SNS_TOPIC_ARN__|${TOPIC_ARN}|g" \
  -e "s|REPLACE_WITH_YOUR_BRAKET_RESULTS_BUCKET|${BRAKET_RESULTS_BUCKET}|g" \
  "$SOURCE_DEFINITION" > "$TMP_DEFINITION"

# Checked against the OUTPUT, not the source — the source is supposed to
# contain these exact placeholder tokens (that's what the sed above just
# replaced). This only catches a genuinely unhandled placeholder that
# survived substitution, e.g. a new one added to the JSON without a
# matching sed rule above.
if grep -q "REPLACE_WITH_YOUR\|__EVENTBRIDGE_CONNECTION_ARN__\|__SNS_TOPIC_ARN__" "$TMP_DEFINITION"; then
  echo "ERROR: the substituted definition still has an unfilled placeholder — check the sed rules above against ${SOURCE_DEFINITION}." >&2
  exit 1
fi

echo "==> Creating/updating state machine '${STATE_MACHINE_NAME}'..."
EXISTING_ARN=$(aws stepfunctions list-state-machines --region "$REGION" \
  --query "stateMachines[?name=='${STATE_MACHINE_NAME}'].stateMachineArn" --output text)

if [ -n "$EXISTING_ARN" ]; then
  echo "    State machine already exists — updating its definition."
  aws stepfunctions update-state-machine \
    --state-machine-arn "$EXISTING_ARN" \
    --definition "file://${TMP_DEFINITION}" \
    --role-arn "$ROLE_ARN" \
    --region "$REGION"
  echo "    ${EXISTING_ARN}"
else
  STATE_MACHINE_ARN=$(aws stepfunctions create-state-machine \
    --name "$STATE_MACHINE_NAME" \
    --definition "file://${TMP_DEFINITION}" \
    --role-arn "$ROLE_ARN" \
    --type STANDARD \
    --region "$REGION" \
    --query stateMachineArn --output text)
  echo "    ${STATE_MACHINE_ARN}"
fi

echo ""
echo "==> Done. Remaining manual steps:"
echo "    1. Subscribe a real recipient to ${TOPIC_ARN} (see command above)."
echo "    2. Set AWS_REGION=${REGION}, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in this app's"
echo "       deployment environment, for an identity with states:SendTaskSuccess/SendTaskFailure"
echo "       permission on the state machine — that's what app/api/kali/approve-task/route.ts uses."
