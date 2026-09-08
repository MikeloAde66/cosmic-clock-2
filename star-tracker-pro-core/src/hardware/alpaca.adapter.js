// Node 22+ has a built-in global `fetch`, so no node-fetch dependency is needed.

export class AlpacaAdapter {
  constructor(host = '127.0.0.1', port = 11111, deviceNumber = 0) {
    this.baseUrl = `http://${host}:${port}/api/v1/telescope/${deviceNumber}`;
  }

  async getTrackingStatus() {
    const res = await fetch(`${this.baseUrl}/tracking`);
    const data = await res.json();
    return data.Value;
  }

  async slewToTarget(raHours, decDegrees) {
    // Convert decimal RA to Alpaca expected value if needed
    const params = new URLSearchParams({
      RightAscension: raHours.toString(),
      Declination: decDegrees.toString(),
      ClientID: '1',
      ClientTransactionID: Date.now().toString(),
    });

    const res = await fetch(`${this.baseUrl}/slewtocoordinatesasync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await res.json();
    if (data.ErrorNumber !== 0) {
      throw new Error(`Alpaca Slew Error: ${data.ErrorMessage}`);
    }
    return data;
  }

  async emergencyStop() {
    await fetch(`${this.baseUrl}/abortslew`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ClientID: '1', ClientTransactionID: Date.now().toString() }),
    });
  }
}
