const metrics = [
  {label: 'Total locations', value: '—'},
  {label: 'Published', value: '—'},
  {label: 'Needs coordinates', value: '—'},
  {label: 'Connected products', value: '—'},
];

export default function DashboardPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Distributor Map</p>
          <h1>Store locator dashboard</h1>
        </div>
        <span className="status">Foundation ready</span>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Physical retail, organized</p>
          <h2>Manage every place your customers can find you.</h2>
          <p className="hero-copy">
            Locations, products, opening hours, and storefront search will live here in one tenant-safe workspace.
          </p>
        </div>
        <div className="hero-orbit" aria-hidden="true"><span /></div>
      </section>

      <section className="metrics" aria-label="Location metrics">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="next-step">
        <div>
          <p className="eyebrow">Next milestone</p>
          <h2>Create your first location</h2>
          <p>Connect the authenticated Shopify shop, then add the location editor and Neon-backed data layer.</p>
        </div>
        <a href="/locations/new">Open location editor</a>
      </section>
    </main>
  );
}
