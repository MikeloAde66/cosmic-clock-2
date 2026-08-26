#!/usr/bin/env bash
# Provisions the real AWS resources kali-quantum-workflow.json needs:
# an SNS topic for approval notifications, an IAM execution role for the
# state machine, and the state machine itself.
#
# This was written for account 060274391988 / region us-east-2, but
# NOT run against it — there's no AWS CLI or credentials in the sandbox
# this was written in (verified: `which aws` found nothing, no AWS_*
# env vars set). Run this yourself, from a shell where
# `aws sts get-caller-identity` already resolves to that account.
#
# Before running: open aws/step-functions/kali-quantum-workflow.json and
# replace REPLACE_WITH_YOUR_KALI_VALIDATION_SERVICE_ENDPOINT and
# REPLACE_WITH_YOUR_BRAKET_RESULTS_BUCKET with real values — this script
# does not create the validation microservice or the S3 results bucket,
# both of which need to already exist.

set -euo pipefail

REGION="us-east-2"
ACCOUNT_ID="060274391988"
TOPIC_NAME="kali-quantum-approvals"
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
      "Action": ["execute-api:Invoke"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::REPLACE_WITH_YOUR_BRAKET_RESULTS_BUCKET/*"
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

echo "==> Creating/updating state machine '${STATE_MACHINE_NAME}'..."
DEFINITION_PATH="$(dirname "$0")/step-functions/kali-quantum-workflow.json"
if grep -q "REPLACE_WITH_YOUR" "$DEFINITION_PATH"; then
  echo "ERROR: ${DEFINITION_PATH} still has REPLACE_WITH_YOUR_* placeholders in it — fill those in first." >&2
  exit 1
fi

EXISTING_ARN=$(aws stepfunctions list-state-machines --region "$REGION" \
  --query "stateMachines[?name=='${STATE_MACHINE_NAME}'].stateMachineArn" --output text)

if [ -n "$EXISTING_ARN" ]; then
  echo "    State machine already exists — updating its definition."
  aws stepfunctions update-state-machine \
    --state-machine-arn "$EXISTING_ARN" \
    --definition "file://${DEFINITION_PATH}" \
    --role-arn "$ROLE_ARN" \
    --region "$REGION"
  echo "    ${EXISTING_ARN}"
else
  STATE_MACHINE_ARN=$(aws stepfunctions create-state-machine \
    --name "$STATE_MACHINE_NAME" \
    --definition "file://${DEFINITION_PATH}" \
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
echo "    3. Deploy/verify the external circuit-validation service referenced in"
echo "       kali-quantum-workflow.json's ValidateCircuit state."
