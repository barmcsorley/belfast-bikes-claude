const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;
const BERYL_BASE = 'https://gbfs.beryl.cc/v2_2/Belfast';

app.use(cors());
app.use(express.static('.'));

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
    for (const s of statusData.data.stations) {
      statusMap[s.station_id] = s;
    }

    const stations = infoData.data.stations.map(info => {
      const status = statusMap[info.station_id] || {};

      // Parse vehicle type breakdown
      const types = {};
      for (const vt of (status.vehicle_types_available || [])) {
        types[vt.vehicle_type_id] = vt.count;
      }

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

app.get('/api/debug', async (req, res) => {
  try {
    const statusRes = await fetch(BERYL_BASE + '/station_status.json');
    const data = await statusRes.json();
    res.json(data.data.stations.slice(0, 3));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('\n🚲 Belfast Bikes server running at http://localhost:' + PORT);
  console.log('   Visit http://localhost:' + PORT + '/index.html\n');
});
