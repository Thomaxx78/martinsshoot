import { useState } from "react";
import { COUNTRY_COORDINATES, LAND } from "../../data/map";
import { contributionStats } from "../../lib/stats";

function Bars({ rows, format = (value) => value }) {
  const maximum = Math.max(1, ...rows.map(([, value]) => value));
  return rows.length ? (
    rows.map(([label, value]) => (
      <div className="bar-row" key={label}>
        <div className="row">
          <span>{label}</span>
          <b>{format(value)}</b>
        </div>
        <div className="bar-track">
          <span
            className="bar"
            style={{ width: `${(value / maximum) * 100}%` }}
          />
        </div>
      </div>
    ))
  ) : (
    <p className="mu">No data yet.</p>
  );
}

function WorldMap({ countries, selected, onSelect, zoom }) {
  const center =
    selected && COUNTRY_COORDINATES[selected]
      ? [
          COUNTRY_COORDINATES[selected][0] + 180,
          85 - COUNTRY_COORDINATES[selected][1],
        ]
      : [180, 75];
  const width = 360 / zoom;
  const height = 150 / zoom;
  const x = Math.max(0, Math.min(360 - width, center[0] - width / 2));
  const y = Math.max(0, Math.min(150 - height, center[1] - height / 2));
  const maximum = Math.max(
    1,
    ...Object.values(countries).map((country) => country.count),
  );
  return (
    <svg
      role="img"
      aria-label="Simplified world map of customers"
      viewBox={`${x} ${y} ${width} ${height}`}
      className="world-map"
    >
      {LAND.map((polygon, index) => (
        <polygon
          key={index}
          points={polygon
            .map(
              ([longitude, latitude]) => `${longitude + 180},${85 - latitude}`,
            )
            .join(" ")}
          fill="var(--sf)"
          stroke="var(--bd)"
          strokeWidth=".4"
        />
      ))}
      {Object.entries(countries)
        .filter(([country]) => COUNTRY_COORDINATES[country])
        .map(([country, data]) => (
          <circle
            key={country}
            cx={COUNTRY_COORDINATES[country][0] + 180}
            cy={85 - COUNTRY_COORDINATES[country][1]}
            r={(2 + Math.sqrt(data.count / maximum) * 5) / Math.sqrt(zoom)}
            fill="var(--ac)"
            fillOpacity=".55"
            stroke="var(--ac)"
            strokeWidth={country === selected ? 1.2 : 0.3}
            className="map-bubble"
            onClick={() => onSelect(country)}
          >
            <title>
              {country}: {data.count}
            </title>
          </circle>
        ))}
    </svg>
  );
}

function Timeline({ shoots, currency }) {
  const points = shoots
    .filter((shoot) => shoot.date && Number(shoot.amount) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length)
    return <p className="mu">Add dated amounts to see this.</p>;
  const width = 340;
  const height = 130;
  const times = points.map((shoot) => new Date(shoot.date).getTime());
  const minimumTime = Math.min(...times);
  const maximumTime = Math.max(...times);
  const maximumAmount = Math.max(
    ...points.map((shoot) => Number(shoot.amount)),
  );
  const position = (shoot, index) => [
    maximumTime === minimumTime
      ? width / 2
      : 20 +
        ((times[index] - minimumTime) / (maximumTime - minimumTime)) *
          (width - 30),
    height - 15 - (Number(shoot.amount) / maximumAmount) * (height - 30),
  ];
  return (
    <svg
      role="img"
      aria-label="Contributions over time"
      viewBox={`0 0 ${width} ${height}`}
      className="chart"
    >
      <polyline
        fill="none"
        stroke="var(--ac)"
        strokeWidth="2"
        points={points
          .map((shoot, index) => position(shoot, index).join(","))
          .join(" ")}
      />
      {points.map((shoot, index) => {
        const [x, y] = position(shoot, index);
        return (
          <circle
            key={shoot.id || index}
            cx={x}
            cy={y}
            r="3.5"
            fill="var(--ac)"
          >
            <title>
              {shoot.date}: {currency}
              {shoot.amount}
            </title>
          </circle>
        );
      })}
      <text x="2" y="12" fontSize="10" fill="var(--mu)">
        {currency}
        {maximumAmount}
      </text>
      <text x="2" y={height - 2} fontSize="10" fill="var(--mu)">
        {points[0].date}
      </text>
      <text
        x={width}
        y={height - 2}
        fontSize="10"
        textAnchor="end"
        fill="var(--mu)"
      >
        {points.at(-1).date}
      </text>
    </svg>
  );
}

export function Histogram({ amounts, currency }) {
  if (!amounts?.length) return <p className="mu">No amounts yet.</p>;
  const minimum = amounts[0];
  const maximum = amounts.at(-1);
  const bucketWidth = (maximum - minimum) / 6 || 1;
  const buckets = Array(6).fill(0);
  amounts.forEach(
    (amount) =>
      buckets[Math.min(5, Math.floor((amount - minimum) / bucketWidth))]++,
  );
  const peak = Math.max(...buckets);
  return (
    <>
      <div className="histogram">
        {buckets.map((count, index) => (
          <span
            className="bar"
            key={index}
            style={{ height: `${(count / peak) * 100}%` }}
          />
        ))}
      </div>
      <div className="histogram-labels mu">
        <span>
          {currency}
          {minimum.toFixed(2)}
        </span>
        <span>
          {currency}
          {maximum.toFixed(2)}
        </span>
      </div>
    </>
  );
}

export default function Insights({ shoots, currency }) {
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(1);
  if (!shoots.length)
    return (
      <p className="mu">
        No data yet. Add past shoots to start your statistics.
      </p>
    );
  const countries = {};
  const months = {};
  const methods = {};
  shoots.forEach((shoot) => {
    const country = shoot.country || "Unknown";
    countries[country] ??= { count: 0, amount: 0 };
    countries[country].count++;
    countries[country].amount += Number(shoot.amount) || 0;
    if (shoot.date)
      months[shoot.date.slice(0, 7)] =
        (months[shoot.date.slice(0, 7)] || 0) + (Number(shoot.amount) || 0);
    const method = shoot.method || "unknown";
    methods[method] = (methods[method] || 0) + 1;
  });
  const byCount = Object.entries(countries).sort(
    (a, b) => b[1].count - a[1].count,
  );
  const byRevenue = Object.entries(countries).sort(
    (a, b) => b[1].amount - a[1].amount,
  );
  const monthly = Object.entries(months).sort(([a], [b]) => a.localeCompare(b));
  const maximumMonth = Math.max(1, ...monthly.map(([, amount]) => amount));
  const stats = contributionStats(shoots);
  const selectedCountry = selected ? countries[selected] : null;

  return (
    <>
      <div className="g2">
        <div className="k">
          <div className="st">
            {stats ? `${currency}${stats.average.toFixed(2)}` : "—"}
          </div>
          Average contribution
        </div>
        <div className="k">
          <div className="st">
            {stats ? `${currency}${stats.median.toFixed(2)}` : "—"}
          </div>
          Median
        </div>
      </div>
      <h3>Where customers are from</h3>
      <WorldMap
        countries={countries}
        selected={selected}
        onSelect={setSelected}
        zoom={zoom}
      />
      <div className="map-controls">
        <button
          className="b sm s"
          onClick={() => setZoom(Math.min(8, zoom * 2))}
        >
          Zoom +
        </button>
        <button
          className="b sm s"
          onClick={() => setZoom(Math.max(1, zoom / 2))}
        >
          Zoom −
        </button>
        <button
          className="b sm s"
          onClick={() => {
            setZoom(1);
            setSelected(null);
          }}
        >
          Reset
        </button>
      </div>
      <p className="mu small">
        Simplified map. Bubble size = customers. Tap a bubble or country.
      </p>
      <div className="country-buttons">
        {byCount.map(([country, data]) => (
          <button
            key={country}
            className={`b sm ${country === selected ? "" : "s"}`}
            onClick={() => setSelected(country)}
          >
            {country} {data.count}
          </button>
        ))}
      </div>
      {selectedCountry && (
        <div className="k">
          <h3>{selected}</h3>
          {selectedCountry.count} customers · {currency}
          {selectedCountry.amount} total · {currency}
          {(selectedCountry.amount / selectedCountry.count).toFixed(2)} average
        </div>
      )}
      <div className="k">
        <h3>Contributions over time</h3>
        <Timeline shoots={shoots} currency={currency} />
      </div>
      <div className="k">
        <h3>Revenue by month</h3>
        {monthly.length ? (
          <div className="monthly-bars">
            {monthly.map(([month, amount]) => (
              <div key={month} title={`${currency}${amount}`}>
                <span
                  className="bar"
                  style={{ height: `${(amount / maximumMonth) * 90}px` }}
                />
                {month.slice(2)}
              </div>
            ))}
          </div>
        ) : (
          <p className="mu">No dated entries yet.</p>
        )}
      </div>
      <div className="k">
        <h3>How much people contribute</h3>
        <Histogram amounts={stats?.amounts} currency={currency} />
      </div>
      <div className="k">
        <h3>Customers by country</h3>
        <Bars rows={byCount.map(([country, data]) => [country, data.count])} />
      </div>
      <div className="k">
        <h3>Revenue by country</h3>
        <Bars
          rows={byRevenue.map(([country, data]) => [country, data.amount])}
          format={(amount) => `${currency}${amount}`}
        />
      </div>
      <div className="k">
        <h3>Payment methods</h3>
        <Bars rows={Object.entries(methods)} />
      </div>
    </>
  );
}
