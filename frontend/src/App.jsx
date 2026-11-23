import { useEffect, useMemo, useState } from 'react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar
} from 'recharts';

import {
  Activity,
  Wind,
  Leaf,
  MapPin,
  RefreshCw,
  Search,
  Bell,
  MessageCircle,
  FilePlus2,
  LayoutDashboard,
  ShieldCheck,
  Download,
  Send
} from 'lucide-react';

// API URL
const API = 'http://localhost:8000/api';

// Default locations
const presets = [
  {
    name: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209
  },
  {
    name: 'Chandigarh',
    country: 'India',
    latitude: 30.7333,
    longitude: 76.7794
  },
  {
    name: 'Shimla',
    country: 'India',
    latitude: 31.1048,
    longitude: 77.1734
  },
  {
    name: 'Solan',
    country: 'India',
    latitude: 30.9045,
    longitude: 77.0967
  }
];

// Number formatter
const fmt = (value) => {
  return value == null ? '—' : Number(value).toFixed(1);
};

export default function App() {

  // Location states
  const [place, setPlace] = useState(presets[1]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);

  // Environmental data
  const [env, setEnv] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [green, setGreen] = useState([]);

  // General states
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Overview');

  // AI Assistant states
  const [chat, setChat] = useState('');
  const [messages, setMessages] = useState([]);

  // Reports and alerts
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reportMsg, setReportMsg] = useState('');

  // Citizen report form
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Visible smoke or dust'
  });

  // Admin interventions
  const [interventions, setInterventions] = useState([]);

  // Hourly data
  const hourly = env?.air?.hourly;
  const times = hourly?.time || [];

  // Chart data
  const chart = useMemo(() => {
    return times.map((time, index) => ({
      time: time.slice(5, 16).replace('T', ' '),
      pm25: hourly.pm2_5?.[index],
      pm10: hourly.pm10?.[index]
    }));
  }, [env]);

  // ========================================
  // LOAD AIR QUALITY DATA
  // ========================================

  async function load(p = place) {

    setBusy(true);
    setError('');

    try {

      const [e, s, g] = await Promise.all([

        fetch(
          `${API}/air-quality?latitude=${p.latitude}&longitude=${p.longitude}`
        ).then(response => {
          if (!response.ok) {
            throw new Error('Air-quality service unavailable');
          }
          return response.json();
        }),

        fetch(
          `${API}/severity?latitude=${p.latitude}&longitude=${p.longitude}`
        ).then(response => {
          if (!response.ok) {
            throw new Error('Severity service unavailable');
          }
          return response.json();
        }),

        fetch(
          `${API}/green-priority?latitude=${p.latitude}&longitude=${p.longitude}`
        ).then(response => {
          if (!response.ok) {
            throw new Error('Green priority service unavailable');
          }
          return response.json();
        })

      ]);

      setEnv(e);
      setSeverity(s);
      setGreen(g.results || []);

    } catch (err) {

      setError(
        err.message || 'Unable to load environmental data.'
      );

    } finally {

      setBusy(false);

    }
  }

  // ========================================
  // REFRESH REPORTS, ALERTS AND INTERVENTIONS
  // ========================================

  async function refreshLists() {

    try {

      const [r, a, i] = await Promise.all([

        fetch(`${API}/reports`).then(response => {
          if (!response.ok) throw new Error('Reports unavailable');
          return response.json();
        }),

        fetch(`${API}/alerts`).then(response => {
          if (!response.ok) throw new Error('Alerts unavailable');
          return response.json();
        }),

        fetch(`${API}/admin/interventions`).then(response => {
          if (!response.ok) throw new Error('Interventions unavailable');
          return response.json();
        })

      ]);

      setReports(r);
      setAlerts(a);
      setInterventions(i);

    } catch (err) {

      console.error('Unable to refresh lists:', err);

    }
  }

  // Initial loading
  useEffect(() => {

    load();
    refreshLists();

  }, []);

  // ========================================
  // SEARCH LOCATIONS
  // ========================================

  useEffect(() => {

    const timer = setTimeout(async () => {

      if (query.trim().length < 2) {
        setMatches([]);
        return;
      }

      try {

        const response = await fetch(
          `${API}/locations/search?q=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
          throw new Error('Location search failed');
        }

        const data = await response.json();

        setMatches(data.results || []);

      } catch {

        setMatches([]);

      }

    }, 350);

    return () => clearTimeout(timer);

  }, [query]);

  // ========================================
  // AI ASSISTANT
  // ========================================

  async function sendChat() {

    if (!chat.trim()) return;

    const text = chat;

    setMessages(previous => [
      ...previous,
      { role: 'you', text }
    ]);

    setChat('');

    const body = {

      message: text,
      location: place.name,

      pm25: hourly?.pm2_5?.[0],
      pm10: hourly?.pm10?.[0],

      severity: severity?.score,

      forecast_summary:
        hourly?.pm2_5?.[24] != null
          ? `Tomorrow hourly PM2.5 starts at ${hourly.pm2_5[24]} µg/m³`
          : 'not available'

    };

    try {

      const response = await fetch(`${API}/chat`, {

        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(body)

      });

      if (!response.ok) {
        throw new Error('Assistant service unavailable');
      }

      const data = await response.json();

      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          text: data.answer || 'No response received.'
        }
      ]);

    } catch {

      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          text: 'Assistant service is unavailable. Please check the backend.'
        }
      ]);

    }
  }

  // ========================================
  // SUBMIT CITIZEN REPORT
  // ========================================

  async function submitReport(e) {

    e.preventDefault();

    const formData = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      formData.append(key,value);
    });

    const photo = document.getElementById('photo')?.files?.[0];

    if (photo) {
      formData.append('photo', photo);
    }

    try {

      const response = await fetch(`${API}/reports`, {

        method: 'POST',
        body: formData

      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Submission failed');
      }

      setReportMsg(
        `Submitted successfully. Your report ID is ${data.report_id}.`
      );

      setForm({
        title: '',
        description: '',
        category: 'Visible smoke or dust'
      });

     const photoInput = document.getElementById('photo');
if (photoInput) {
  photoInput.value = '';
}

      await refreshLists();

    } catch (err) {

      setReportMsg(err.message);

    }
  }

  // ========================================
  // REVIEW CITIZEN REPORT
  // ========================================

  async function review(id, status) {

    try {

      const response = await fetch(
        `${API}/admin/reports/${id}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            status,
            admin_notes: 'Reviewed in dashboard'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Unable to update report');
      }

      await refreshLists();

    } catch (err) {

      console.error(err);
      alert('Report update failed');

    }
  }

  // ========================================
  // DELETE INTERVENTION
  // ========================================

  async function deleteIntervention(id) {

    const confirmDelete = window.confirm(
      'Are you sure you want to delete this action?'
    );

    if (!confirmDelete) return;

    try {

      const response = await fetch(
        `${API}/admin/interventions/${id}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error('Unable to delete intervention');
      }

      await refreshLists();

      alert('Intervention deleted successfully!');

    } catch (err) {

      console.error(err);
      alert('Error deleting intervention');

    }
  }

  // ========================================
  // CREATE POLLUTION ALERT
  // ========================================

  async function makeAlert() {

    try {

      const response = await fetch(
        `${API}/alerts/evaluate?latitude=${place.latitude}&longitude=${place.longitude}&location=${encodeURIComponent(place.name)}`,
        {
          method: 'POST'
        }
      );

      if (!response.ok) {
        throw new Error('Unable to evaluate alert');
      }

      await refreshLists();

      alert('Location evaluated successfully!');

    } catch (err) {

      console.error(err);
      alert('Alert evaluation failed');

    }
  }

  // ========================================
  // CALCULATIONS
  // ========================================

  const tomorrow = chart.slice(24, 48);

  const avg = (arr) => {

    const validValues = arr.filter(
      value => typeof value === 'number' && Number.isFinite(value)
    );

    return validValues.length
      ? validValues.reduce((a, b) => a + b, 0) / validValues.length
      : null;

  };

  const maxValue = (arr) => {

    const validValues = arr.filter(
      value => typeof value === 'number' && Number.isFinite(value)
    );

    return validValues.length
      ? Math.max(...validValues)
      : null;

  };

  const pm25 = hourly?.pm2_5?.[0];
  const pm10 = hourly?.pm10?.[0];

  // ========================================
  // SIDEBAR NAVIGATION
  // ========================================

  const nav = [

    ['Overview', LayoutDashboard],
    ['Air Quality', Wind],
    ['Forecast & Analytics', Activity],
    ['Green Priority', Leaf],
    ['Citizen Reports', FilePlus2],
    ['Alerts', Bell],
    ['AI Assistant', MessageCircle],
    ['Admin', ShieldCheck]

  ];

  // ========================================
  // MAIN UI
  // ========================================

  return (

    <div className="shell">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand">

          <span className="brand-icon">
            <Leaf size={22} />
          </span>

          <div>
            <b>EcoAI</b>
            <small>ENVIRONMENTAL INTELLIGENCE</small>
          </div>

        </div>

        <div className="nav-label">
          WORKSPACE
        </div>

        {nav.map(([name, Icon]) => (

          <button
            key={name}
            className={`nav-item ${tab === name ? 'active' : ''}`}
            onClick={() => setTab(name)}
          >

            <Icon size={18} />

            {name}

          </button>

        ))}

        <div className="side-bottom">

          <div className="status-dot" />

          API workspace

          <span>v1.0</span>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="main">

        {/* TOPBAR */}

        <header className="topbar">

          <div>

            <div className="eyebrow">
              ENVIRONMENTAL MONITORING / INDIA
            </div>

            <h1>{tab}</h1>

          </div>

          <div className="top-actions">

            {/* SEARCH */}

            <div className="searchbox">

              <Search size={16} />

              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search a city..."
              />

              {matches.length > 0 && (

                <div className="suggestions">

                  {matches.map((m, index) => (

                    <button
                      key={`${m.latitude}-${m.longitude}-${index}`}
                      onClick={() => {

                        const selectedPlace = {
                          ...m,
                          name: m.name
                        };

                        setPlace(selectedPlace);
                        setQuery('');
                        setMatches([]);

                        load(selectedPlace);

                      }}
                    >

                      {m.name}, {m.admin1 || m.country}

                    </button>

                  ))}

                </div>

              )}

            </div>

            {/* REFRESH */}

            <button
              className="icon-btn"
              onClick={() => load()}
              title="Refresh"
              disabled={busy}
            >

              <RefreshCw size={17} />

            </button>

            <div className="avatar">
              E
            </div>

          </div>

        </header>

        {/* PAGE CONTENT */}

        <div className="content">

          {error && (

            <div className="error">

              {error} — ensure the FastAPI backend is running at localhost:8000.

            </div>

          )}

          {/* ================================= */}
          {/* OVERVIEW */}
          {/* ================================= */}

          {tab === 'Overview' && (

            <>

              <div className="welcome">

                <div>

                  <span className="pill">

                    <span className="live-dot" />

                    MONITORING ACTIVE

                  </span>

                  <h2>
                    Good day. Here's your air quality brief.
                  </h2>

                  <p>
                    Understand conditions, track forecasts, and turn environmental data into action.
                  </p>

                </div>

                <div className="location-pill">

                  <MapPin size={16} />

                  <div>

                    <small>SELECTED LOCATION</small>

                    <b>
                      {place.name}, {place.country || 'India'}
                    </b>

                  </div>

                </div>

              </div>

              {/* METRICS */}

              <div className="grid metrics">

                <Metric
                  title="PM2.5"
                  value={fmt(pm25)}
                  unit="µg/m³"
                  note="Model forecast • current hour"
                  icon={<Wind />}
                />

                <Metric
                  title="PM10"
                  value={fmt(pm10)}
                  unit="µg/m³"
                  note="Model forecast • current hour"
                  icon={<Activity />}
                />

                <Metric
                  title="EcoAI Severity"
                  value={severity?.score ?? '—'}
                  unit="/ 100"
                  note={severity?.category || 'Awaiting data'}
                  icon={<ShieldCheck />}
                />

                <Metric
                  title="Tomorrow PM2.5 avg"
                  value={fmt(avg(hourly?.pm2_5?.slice(24, 48) || []))}
                  unit="µg/m³"
                  note="External model forecast"
                  icon={<Leaf />}
                />

              </div>

              {/* CHART AND FORECAST */}

              <div className="grid two">

                <section className="panel chart-panel">

                  <PanelTitle
                    title="Air quality trend"
                    subtitle="Hourly pollutant forecast • next 48 hours"
                  />

                  <div className="legend">

                    <span className="legend-a" />
                    PM2.5

                    <span className="legend-b" />
                    PM10

                  </div>

                  <div className="chart">

                    <ResponsiveContainer width="100%" height="100%">

                      <AreaChart data={chart}>

                        <defs>

                          <linearGradient
                            id="p"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >

                            <stop
                              offset="0%"
                              stopColor="#1a9b73"
                              stopOpacity={0.25}
                            />

                            <stop
                              offset="100%"
                              stopColor="#1a9b73"
                              stopOpacity={0}
                            />

                          </linearGradient>

                        </defs>

                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e9efeb"
                        />

                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10 }}
                          interval={7}
                        />

                        <YAxis
                          tick={{ fontSize: 11 }}
                        />

                        <Tooltip />

                        <Area
                          type="monotone"
                          dataKey="pm25"
                          name="PM2.5"
                          stroke="#168d69"
                          fill="url(#p)"
                          strokeWidth={2}
                        />

                        <Area
                          type="monotone"
                          dataKey="pm10"
                          name="PM10"
                          stroke="#e0a348"
                          fill="none"
                          strokeWidth={2}
                        />

                      </AreaChart>

                    </ResponsiveContainer>

                  </div>

                  <div className="source-note">

                    {env?.source || 'Loading source…'} ·

                    {env?.air?.timezone || 'local timezone'} ·

                    {env?.demo ? 'Demo mode' : 'Forecast data'}

                  </div>

                </section>

                {/* TOMORROW FORECAST */}

                <section className="panel">

                  <PanelTitle
                    title="Tomorrow's outlook"
                    subtitle="Forecast summary • model output"
                  />

                  <div className="forecast-stat">

                    <div>

                      <small>PM2.5 DAILY AVERAGE</small>

                      <strong>
                        {fmt(avg(hourly?.pm2_5?.slice(24, 48) || []))}
                      </strong>

                      <span>µg/m³</span>

                    </div>

                    <div className="forecast-badge">

                      {(avg(hourly?.pm2_5?.slice(24, 48) || []) || 0) > 35
                        ? 'Elevated forecast'
                        : 'Lower forecast'}

                    </div>

                  </div>

                  <div className="mini-list">

                    <div>

                      <span>Maximum PM2.5</span>

                      <b>
                        {fmt(maxValue(hourly?.pm2_5?.slice(24, 48) || []))} µg/m³
                      </b>

                    </div>

                    <div>

                      <span>Maximum PM10</span>

                      <b>
                        {fmt(maxValue(hourly?.pm10?.slice(24, 48) || []))} µg/m³
                      </b>

                    </div>

                    <div>

                      <span>Forecast hours</span>

                      <b>{tomorrow.length} hours</b>

                    </div>

                  </div>

                  <p className="muted small">
                    Forecasts are model estimates, not direct ground-station readings.
                  </p>

                  <button
                    className="outline-btn"
                    onClick={() => setTab('Forecast & Analytics')}
                  >
                    View forecast details →
                  </button>

                </section>

              </div>

              {/* GREEN PRIORITY AND ACTIVITY */}

              <div className="grid two">

                <section className="panel">

                  <PanelTitle
                    title="Green priority candidates"
                    subtitle="Illustrative demo-grid ranking"
                  />

                  {green.slice(0, 3).map(g => (

                    <div className="rank-row" key={g.id}>

                      <div className="rank-num">
                        0{g.id}
                      </div>

                      <div className="rank-info">

                        <b>{g.location}</b>

                        <small>{g.label}</small>

                        <div className="progress">

                          <i style={{ width: `${g.score}%` }} />

                        </div>

                      </div>

                      <strong>{g.score}</strong>

                    </div>

                  ))}

                  {green.length === 0 && (
                    <p className="muted">No green priority data available.</p>
                  )}

                </section>

                <section className="panel">

                  <PanelTitle
                    title="Environmental activity"
                    subtitle="Latest platform records"
                  />

                  <div className="activity-row">

                    <span className="activity-icon">
                      <FilePlus2 />
                    </span>

                    <div>

                      <b>{reports.length} citizen reports</b>

                      <small>Reports submitted for review</small>

                    </div>

                  </div>

                  <div className="activity-row">

                    <span className="activity-icon amber">
                      <Bell />
                    </span>

                    <div>

                      <b>
                        {alerts.filter(a => a.status === 'Unacknowledged').length} active alerts
                      </b>

                      <small>Unacknowledged notifications</small>

                    </div>

                  </div>

                  <div className="activity-row">

                    <span className="activity-icon">
                      <ShieldCheck />
                    </span>

                    <div>

                      <b>{interventions.length} intervention tasks</b>

                      <small>Municipal action tracking</small>

                    </div>

                  </div>

                </section>

              </div>

            </>

          )}

          {/* ================================= */}
          {/* AIR QUALITY */}
          {/* ================================= */}

          {tab === 'Air Quality' && (

            <>

              <div className="page-intro">

                <h2>Location air quality</h2>

                <p>
                  Pollutant concentrations returned by Open-Meteo's forecast model.
                </p>

              </div>

              <div className="grid metrics">

                <Metric
                  title="PM2.5"
                  value={fmt(pm25)}
                  unit="µg/m³"
                  note="Forecast concentration"
                  icon={<Wind />}
                />

                <Metric
                  title="PM10"
                  value={fmt(pm10)}
                  unit="µg/m³"
                  note="Forecast concentration"
                  icon={<Activity />}
                />

                <Metric
                  title="Ozone"
                  value={fmt(hourly?.ozone?.[0])}
                  unit="µg/m³"
                  note="Forecast concentration"
                  icon={<Activity />}
                />

                <Metric
                  title="NO₂"
                  value={fmt(hourly?.nitrogen_dioxide?.[0])}
                  unit="µg/m³"
                  note="Forecast concentration"
                  icon={<Activity />}
                />

              </div>

              <section className="panel">

                <PanelTitle
                  title="Pollutant concentrations"
                  subtitle="Current forecast hour and source metadata"
                />

                <div className="table-wrap">

                  <table>

                    <thead>

                      <tr>
                        <th>Pollutant</th>
                        <th>Concentration</th>
                        <th>Unit</th>
                        <th>Data type</th>
                      </tr>

                    </thead>

                    <tbody>

                      {[
                        ['PM2.5', pm25],
                        ['PM10', pm10],
                        ['Ozone', hourly?.ozone?.[0]],
                        ['Nitrogen dioxide', hourly?.nitrogen_dioxide?.[0]],
                        ['Sulphur dioxide', hourly?.sulphur_dioxide?.[0]],
                        ['Carbon monoxide', hourly?.carbon_monoxide?.[0]]
                      ].map(([name, value]) => (

                        <tr key={name}>

                          <td>{name}</td>

                          <td>{fmt(value)}</td>

                          <td>µg/m³</td>

                          <td>
                            <span className="tag">
                              Model forecast
                            </span>
                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

                <p className="source-note">
                  {env?.source || 'Source unavailable'}. This dashboard does not label PM2.5 alone as official AQI.
                </p>

              </section>

            </>

          )}

          {/* ================================= */}
          {/* FORECAST AND ANALYTICS */}
          {/* ================================= */}

          {tab === 'Forecast & Analytics' && (

            <>

              <div className="page-intro">

                <h2>Forecast & analytics</h2>

                <p>
                  Explore hourly pollutant trends. Tomorrow is the second forecast day in the returned local-time series.
                </p>

              </div>

              <section className="panel">

                <PanelTitle
                  title="Tomorrow's PM2.5 forecast"
                  subtitle="Hourly values • µg/m³"
                />

                <div className="chart tall">

                  <ResponsiveContainer width="100%" height="100%">

                    <BarChart data={tomorrow}>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10 }}
                        interval={3}
                      />

                      <YAxis />

                      <Tooltip />

                      <Bar
                        dataKey="pm25"
                        name="PM2.5"
                        fill="#168d69"
                        radius={[4, 4, 0, 0]}
                      />

                    </BarChart>

                  </ResponsiveContainer>

                </div>

                <p className="source-note">
                  {env?.source || 'No data loaded'}
                </p>

              </section>

              <section className="panel">

                <PanelTitle
                  title="Severity methodology"
                  subtitle="Custom provisional score, not official AQI"
                />

                <div className="score-box">

                  <strong>{severity?.score ?? '—'}</strong>

                  <span>{severity?.category || 'Awaiting data'}</span>

                </div>

                <p>
                  {severity?.method || 'Severity methodology will appear when data is available.'}
                </p>

                <p className="muted small">

                  The MVP normalizes available PM2.5 and PM10 values to illustrative reference levels. It does not implement CPCB National AQI averaging and pollutant completeness requirements.

                </p>

              </section>

            </>

          )}

          {/* ================================= */}
          {/* GREEN PRIORITY */}
          {/* ================================= */}

          {tab === 'Green Priority' && (

            <>

              <div className="page-intro">

                <h2>Green Priority Index</h2>

                <p>
                  Decision-support shortlist for field assessment, not a tree-planting instruction.
                </p>

              </div>

              <div className="notice">

                Illustrative demo data only. No live ESA WorldCover raster processing is connected in this MVP. Low tree cover does not automatically mean land is suitable for planting.

              </div>

              <section className="panel">

                <PanelTitle
                  title="Candidate ranking"
                  subtitle="50% pollution priority · 30% vegetation deficit · 20% site suitability"
                />

                {green.map(g => (

                  <div className="green-card" key={g.id}>

                    <div>

                      <b>{g.location}</b>

                      <small>{g.label}</small>

                    </div>

                    <strong>{g.score}/100</strong>

                    <div className="mini-components">

                      <span>
                        Pollution {g.pollution_priority}
                      </span>

                      <span>
                        Vegetation deficit {g.vegetation_deficit}
                      </span>

                      <span>
                        Site suitability {g.site_suitability}
                      </span>

                    </div>

                  </div>

                ))}

                {green.length === 0 && (
                  <p className="muted">No candidate data available.</p>
                )}

              </section>

            </>

          )}

          {/* ================================= */}
          {/* CITIZEN REPORTS */}
          {/* ================================= */}

          {tab === 'Citizen Reports' && (

            <>

              <div className="page-intro">

                <h2>Citizen pollution reporting</h2>

                <p>
                  Submit a local environmental concern. Every submission remains unverified until reviewed.
                </p>

              </div>

              <div className="grid two">

                {/* REPORT FORM */}

                <section className="panel">

                  <PanelTitle
                    title="Submit a report"
                    subtitle="No account required for this MVP"
                  />

                  <form
                    className="form"
                    onSubmit={submitReport}
                  >

                    <label>

                      Report title

                      <input
                        required
                        value={form.title}
                        onChange={e => setForm({
                          ...form,
                          title: e.target.value
                        })}
                        placeholder="e.g. Smoke near the market"
                      />

                    </label>

                    <label>

                      Pollution category

                      <select
                        value={form.category}
                        onChange={e => setForm({
                          ...form,
                          category: e.target.value
                        })}
                      >

                        {[
                          'Visible smoke or dust',
                          'Industrial pollution concern',
                          'Traffic-related pollution concern',
                          'Waste burning',
                          'Construction dust',
                          'Plastic or solid waste pollution',
                          'Other environmental concern'
                        ].map(category => (

                          <option key={category}>
                            {category}
                          </option>

                        ))}

                      </select>

                    </label>

                    <label>

                      Description

                      <textarea
                        required
                        rows={4}
                        value={form.description}
                        onChange={e => setForm({
                          ...form,
                          description: e.target.value
                        })}
                        placeholder="Describe what you noticed..."
                      />

                    </label>

                    <label>

                      Photo (optional)

                      <input
                        type="file"
                        id="photo"
                        accept="image/png,image/jpeg,image/webp"
                      />

                    </label>

                    <button
                      type="submit"
                      className="primary-btn"
                    >
                      Submit report
                    </button>

                    {reportMsg && (

                      <p className="success-msg">
                        {reportMsg}
                      </p>

                    )}

                  </form>

                </section>

                {/* RECENT REPORTS */}

                <section className="panel">

                  <PanelTitle
                    title="Recent reports"
                    subtitle="Citizen submissions • pending review"
                  />

                  {reports.length === 0 ? (

                    <p className="muted">
                      No reports submitted yet.
                    </p>

                  ) : (

                    reports.map(r => (

                      <div
                        className="report-row"
                        key={r.report_id}
                      >

                        <div>

                          <b>{r.title}</b>

                          <small>
                            {r.category} · {r.report_id}
                          </small>

                        </div>

                        <span className="tag">
                          {r.status}
                        </span>

                      </div>

                    ))

                  )}

                </section>

              </div>

            </>

          )}

          {/* ================================= */}
          {/* ALERTS */}
          {/* ================================= */}

          {tab === 'Alerts' && (

            <>

              <div className="page-intro">

                <h2>Pollution alerts</h2>

                <p>
                  Evaluate the selected location against the configured PM2.5 threshold.
                </p>

              </div>

              <section className="panel">

                <div className="panel-head">

                  <div>

                    <h3>Alert centre</h3>

                    <p>
                      Forecast-based alerts are not ground-observation warnings.
                    </p>

                  </div>

                  <button
                    className="primary-btn"
                    onClick={makeAlert}
                  >
                    Evaluate selected location
                  </button>

                </div>

                {alerts.length === 0 ? (

                  <p className="muted">
                    No alerts recorded. Use Evaluate to check current forecast context.
                  </p>

                ) : (

                  alerts.map(a => (

                    <div className="report-row" key={a.id}>

                      <div>

                        <b>
                          {a.location} · {a.level}
                        </b>

                        <small>
                          {a.condition} — {a.source}
                        </small>

                      </div>

                      <span className="tag">
                        {a.status}
                      </span>

                    </div>

                  ))

                )}

              </section>

            </>

          )}

          {/* ================================= */}
          {/* AI ASSISTANT */}
          {/* ================================= */}

          {tab === 'AI Assistant' && (

            <>

              <div className="page-intro">

                <h2>EcoAI Assistant</h2>

                <p>
                  Rule-based environmental explainer using the selected dashboard context. No paid LLM required.
                </p>

              </div>

              <section className="panel chat-panel">

                <div className="chat-messages">

                  {messages.length === 0 && (

                    <div className="chat-welcome">

                      <MessageCircle size={28} />

                      <b>
                        Ask EcoAI about your environment
                      </b>

                      <p>
                        Try "What does the severity score mean?" or "Why might PM2.5 increase tomorrow?"
                      </p>

                    </div>

                  )}

                  {messages.map((message, index) => (

                    <div
                      className={`bubble ${message.role}`}
                      key={index}
                    >

                      <small>

                        {message.role === 'you'
                          ? 'YOU'
                          : 'ECOAI ASSISTANT'}

                      </small>

                      {message.text}

                    </div>

                  ))}

                </div>

                <form
                  className="chat-input"
                  onSubmit={e => {
                    e.preventDefault();
                    sendChat();
                  }}
                >

                  <input
                    value={chat}
                    onChange={e => setChat(e.target.value)}
                    placeholder={`Ask about ${place.name}'s air quality...`}
                  />

                  <button
                    type="submit"
                    className="primary-btn"
                  >

                    <Send size={16} />

                  </button>

                </form>

              </section>

            </>

          )}

          {/* ================================= */}
          {/* ADMIN */}
          {/* ================================= */}

          {tab === 'Admin' && (

            <>

              <div className="page-intro">

                <h2>Administration workspace</h2>

                <p>
                  Demo admin controls. Add authentication and role-based authorization before deployment.
                </p>

              </div>

              {/* CITIZEN REPORT REVIEW */}

              <section className="panel">

                <PanelTitle
                  title="Citizen report review"
                  subtitle="Reports are unverified until an authorized review"
                />

                {reports.length === 0 && (
                  <p className="muted">No reports available for review.</p>
                )}

                {reports.map(r => (

                  <div
                    className="admin-row"
                    key={r.report_id}
                  >

                    <div>

                      <b>{r.title}</b>

                      <small>
                        {r.report_id} · {r.category}
                      </small>

                    </div>

                    <select
                      value={r.status}
                      onChange={e => review(
                        r.report_id,
                        e.target.value
                      )}
                    >

                      <option>Submitted</option>
                      <option>Under Review</option>
                      <option>Verified</option>
                      <option>Rejected</option>
                      <option>Resolved</option>

                    </select>

                  </div>

                ))}

              </section>

              {/* INTERVENTION REGISTER */}

              <section className="panel">

                <PanelTitle
                  title="Intervention Register"
                  subtitle="Create, manage and track environmental actions"
                />

                {/* ADD ACTION FORM */}

                <form
                  className="inline-form"
                  onSubmit={async e => {

                    e.preventDefault();

                    const formElement = e.currentTarget;
                    const formData = new FormData(formElement);

                    try {

                      const response = await fetch(
                        `${API}/admin/interventions`,
                        {

                          method: 'POST',

                          headers: {
                            'Content-Type': 'application/json'
                          },

                          body: JSON.stringify({

                            title: formData.get('title'),
                            location: place.name,
                            description: formData.get('description'),
                            priority: formData.get('priority')

                          })

                        }
                      );

                      if (!response.ok) {
                        throw new Error('Unable to add intervention');
                      }

                      formElement.reset();

                      await refreshLists();

                      alert('Action added successfully!');

                    } catch (err) {

                      console.error(err);

                      alert(err.message);

                    }

                  }}
                >

                  <input
                    name="title"
                    required
                    placeholder="Action title"
                  />

                  <input
                    name="description"
                    required
                    placeholder="Action description"
                  />

                  <select name="priority">

                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Low">Low</option>

                  </select>

                  <button
                    type="submit"
                    className="primary-btn"
                  >
                    Add Action
                  </button>

                </form>

                {/* INTERVENTION LIST */}

                <div className="intervention-list">

                  {interventions.length === 0 ? (

                    <p className="muted">
                      No intervention actions added yet.
                    </p>

                  ) : (

                    interventions.map(i => (

                      <div
                        className="report-row"
                        key={i.id}
                      >

                        <div>

                          <b>{i.title}</b>

                          <small>
                            {i.location} · {i.priority} Priority
                          </small>

                          <small>
                            Task ID: #{i.id}
                          </small>

                        </div>

                        {/* UPDATE STATUS */}

                        <select
                          value={i.status}
                          onChange={async e => {

                            try {

                              const response = await fetch(
                                `${API}/admin/interventions/${i.id}`,
                                {

                                  method: 'PATCH',

                                  headers: {
                                    'Content-Type': 'application/json'
                                  },

                                  body: JSON.stringify({
                                    status: e.target.value
                                  })

                                }
                              );

                              if (!response.ok) {
                                throw new Error('Unable to update status');
                              }

                              await refreshLists();

                            } catch (err) {

                              console.error(err);

                              alert('Status update failed');

                            }

                          }}
                        >

                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>

                        </select>

                        {/* DELETE ACTION */}

                        <button
                          type="button"
                          className="outline-btn"
                          onClick={() => deleteIntervention(i.id)}
                        >
                          Delete
                        </button>

                      </div>

                    ))

                  )}

                </div>

              </section>

              {/* DATA EXPORTS */}

              <section className="panel">

                <PanelTitle
                  title="Data exports"
                  subtitle="Download platform records in CSV format"
                />

                <div className="export-actions">

                  {[
                    'reports',
                    'alerts',
                    'interventions'
                  ].map(key => (

                    <a
                      key={key}
                      className="outline-btn"
                      href={`${API}/export/${key}`}
                    >

                      <Download size={15} />

                      Export {key}

                    </a>

                  ))}

                </div>

              </section>

            </>

          )}

          {/* FOOTER */}

          <footer>

            EcoAI · Environmental intelligence for informed action

            <span>
              Data sources: Open-Meteo · OpenStreetMap attribution where applicable
            </span>

          </footer>

        </div>

      </main>

    </div>

  );

}

// ========================================
// METRIC CARD COMPONENT
// ========================================

function Metric({ title, value, unit, note, icon }) {

  return (

    <section className="metric-card">

      <div className="metric-top">

        <span>{title}</span>

        <i>{icon}</i>

      </div>

      <div className="metric-value">

        {value}

        <small>{unit}</small>

      </div>

      <p>{note}</p>

    </section>

  );

}

// ========================================
// PANEL TITLE COMPONENT
// ========================================

function PanelTitle({ title, subtitle }) {

  return (

    <div className="panel-head">

      <div>

        <h3>{title}</h3>

        <p>{subtitle}</p>

      </div>

    </div>

  );

}