import json
import os
import re
import socket
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

# The INDI stream is a sequence of sibling top-level elements, not one
# well-formed document, so it can't be parsed with ET.fromstring() as a
# whole. Each individual element (e.g. a single <setNumberVector>...
# </setNumberVector>) *is* well-formed on its own, so we pull complete
# top-level elements out of the buffer with regex and parse those one at
# a time as they arrive.
VECTOR_PATTERN = re.compile(
    r'<((?:def|set)(?:Number|Text|Switch|Light|BLOB)Vector)\b.*?</\1>',
    re.DOTALL,
)
SELF_CLOSING_PATTERN = re.compile(r'<(message|delProperty)\b[^>]*/>')

# Standard INDI property names for a telescope's equatorial coordinates.
COORD_PROPERTY_NAMES = {'EQUATORIAL_EOD_COORD', 'EQUATORIAL_COORD'}

# INDI vector "state" -> a plainer status word for the UI.
STATE_LABELS = {
    'Idle': 'IDLE',
    'Ok': 'TRACKING',
    'Busy': 'SLEWING',
    'Alert': 'ERROR',
}

TELEMETRY_URL = os.environ.get('TELEMETRY_URL', 'http://localhost:4000/api/telemetry/indi')


class INDIMountBridge:
    def __init__(self, host='127.0.0.1', port=7624):
        self.host = host
        self.port = port
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    def connect(self):
        try:
            self.sock.connect((self.host, self.port))
            # Send Handshake to subscribe to properties
            self.sock.sendall(b'<getProperties version="1.7"/>')
            print(f"[INDI] Connected to server at {self.host}:{self.port}")
        except Exception as e:
            print(f"[INDI Error] Connection failed: {e}")
            sys.exit(1)

    def listen_stream(self):
        buffer = ""
        while True:
            data = self.sock.recv(4096).decode('utf-8')
            if not data:
                break
            buffer += data

            while True:
                match = VECTOR_PATTERN.search(buffer) or SELF_CLOSING_PATTERN.search(buffer)
                if not match:
                    break
                fragment = match.group(0)
                buffer = buffer[match.end():]
                self.handle_element(fragment)

    def handle_element(self, xml_fragment):
        try:
            el = ET.fromstring(xml_fragment)
        except ET.ParseError as e:
            print(f"[INDI] Skipping unparseable fragment: {e}")
            return

        if not el.tag.endswith('Vector'):
            return  # message / delProperty — no coordinate/status data to report

        device = el.get('device')
        prop_name = el.get('name')
        state = el.get('state')

        values = {}
        for child in el:
            child_name = child.get('name')
            text = (child.text or '').strip()
            if child_name is None:
                continue
            try:
                values[child_name] = float(text)
            except ValueError:
                values[child_name] = text

        event = {
            'device': device,
            'property': prop_name,
            'state': state,
            'status': STATE_LABELS.get(state, state),
            'values': values,
        }

        if prop_name in COORD_PROPERTY_NAMES:
            if 'RA' in values:
                event['ra'] = values['RA']
            if 'DEC' in values:
                event['dec'] = values['DEC']

        self.publish_telemetry(event)

    def publish_telemetry(self, event):
        body = json.dumps(event).encode('utf-8')
        req = urllib.request.Request(
            TELEMETRY_URL,
            data=body,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=2) as resp:
                resp.read()
        except (urllib.error.URLError, OSError) as e:
            # Server not running yet, or briefly unreachable — telemetry is
            # best-effort; don't let a dropped event kill the socket loop.
            print(f"[INDI] Could not publish telemetry: {e}")


if __name__ == "__main__":
    bridge = INDIMountBridge()
    bridge.connect()
    bridge.listen_stream()
