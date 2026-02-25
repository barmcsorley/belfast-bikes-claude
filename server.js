const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;
const BERYL_BASE = 'https://gbfs.beryl.cc/v2_2/Belfast';

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Main stations endpoint
app.get('/api/stations', async (req, res) => {
  try {
    const [infoRes, statusRes] = await Promise.all([
      fetch(BERYL_BASE + '/station_information.json'),
      fetch(BERYL_BASE + '/station_status.json')
    ]);
    if (!infoRes.ok) throw new Error('Station info API responded with ' + infoRes.status);
    if (!statusRes.ok) throw new Error('Station status API responded with ' + statusRes.status);
    const infoData = await infoRes.json();
    const statusData = await statusRes.json();
    const statusMap = {};
    for (const s of statusData.data.stations) statusMap[s.station_id] = s;
    const stations = infoData.data.stations.map(info => {
      const status = statusMap[info.station_id] || {};
      const types = {};
      for (const vt of (status.vehicle_types_available || [])) types[vt.vehicle_type_id] = vt.count;
      return {
        id: String(info.station_id),
        name: info.name,
        latitude: info.lat,
        longitude: info.lon,
        capacity: info.capacity,
        free_bikes: status.num_bikes_available ?? 0,
        empty_slots: status.num_docks_available ?? 0,
        bikes: types['beryl_bike'] ?? 0,
        ebikes: types['bbe'] ?? 0,
        scooters: types['scooter'] ?? 0,
        is_installed: status.is_installed,
        is_renting: status.is_renting,
        is_returning: status.is_returning,
        last_reported: status.last_reported
      };
    });
    res.json({ network: { stations } });
  } catch (err) {
    console.error('Error fetching station data:', err.message);
    res.status(500).json({ error: 'Failed to fetch station data', detail: err.message });
  }
});

// Feedback endpoint - sends email via Gmail
app.post('/api/feedback', async (req, res) => {
  const { station, type, message } = req.body;
  if (!station || !type) return res.status(400).json({ error: 'Missing fields' });

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_PASS;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || GMAIL_USER;

  if (!GMAIL_USER || !GMAIL_PASS) {
    console.log('Feedback received (no email configured):', { station, type, message });
    return res.json({ ok: true });
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASS }
    });
    await transporter.sendMail({
      from: GMAIL_USER,
      to: NOTIFY_EMAIL,
      subject: 'Belfast Bikes feedback: ' + station,
      text: 'Station: ' + station + '\nIssue type: ' + type + '\nMessage: ' + (message || 'None') + '\nTime: ' + new Date().toLocaleString('en-GB')
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.listen(PORT, () => {
  console.log('\n🚲 Belfast Bikes server running at http://localhost:' + PORT);
  console.log('   Visit http://localhost:' + PORT + '/index.html\n');
});
