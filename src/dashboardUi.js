export function renderDashboard(stats) {
    const hitRate = stats.totalRequests ? ((stats.hits / stats.totalRequests) * 100).toFixed(2) : 0;

    const formatBandwidth = (bytes) => {
        if (bytes > 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        if (bytes > 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${bytes} B`;
    };

    const historyData = JSON.stringify(stats.history || []);

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pravah | Real-time Analytics</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            :root {
                --bg: #0b0f19;
                --card-bg: #161c2d;
                --accent: #3b82f6;
                --text: #ffffff;
                --text-muted: #94a3b8;
                --hit: #10b981;
                --miss: #f59e0b;
                --error: #ef4444;
            }
            body { 
                font-family: 'Outfit', sans-serif; 
                background: var(--bg); color: var(--text); 
                margin: 0; padding: 40px;
                display: flex; flex-direction: column; align-items: center;
            }
            .container { width: 100%; max-width: 1200px; }
            header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
            h1 { font-size: 2.5rem; margin: 0; background: linear-gradient(135deg, #60a5fa 0%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            
            .stats-grid { 
                display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; 
                margin-bottom: 40px;
            }
            .card { 
                background: var(--card-bg); padding: 25px; border-radius: 20px; 
                border: 1px solid rgba(255,255,255,0.05);
            }
            .card-title { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px; font-weight: 600; }
            .card-value { font-size: 2rem; font-weight: 600; }

            .chart-container { 
                background: var(--card-bg); padding: 30px; border-radius: 24px; 
                border: 1px solid rgba(255,255,255,0.05); margin-bottom: 40px; 
                height: 400px;
            }

            table { width: 100%; border-collapse: collapse; background: var(--card-bg); border-radius: 20px; overflow: hidden; }
            th, td { padding: 18px 24px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
            th { background: rgba(0,0,0,0.2); color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <div>
                    <h1>Pravah Analytics</h1>
                    <p style="color: var(--text-muted); margin-top: 5px;">Real-time traffic & performance monitoring</p>
                </div>
                <div style="text-align: right;">
                    <div id="status" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--hit);">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--hit); box-shadow: 0 0 10px var(--hit);"></span>
                        Live Feed Active
                    </div>
                </div>
            </header>

            <div class="stats-grid">
                <div class="card">
                    <div class="card-title">Total Requests</div>
                    <div class="card-value">${stats.totalRequests}</div>
                </div>
                <div class="card">
                    <div class="card-title">Bandwidth</div>
                    <div class="card-value" style="color: #a855f7;">${formatBandwidth(stats.bandwidth)}</div>
                </div>
                <div class="card">
                    <div class="card-title">Hit Rate</div>
                    <div class="card-value" style="color: var(--hit);">${hitRate}%</div>
                </div>
                <div class="card">
                    <div class="card-title">Blocked (WAF)</div>
                    <div class="card-value" style="color: var(--error);">${stats.blocked || 0}</div>
                </div>
            </div>

            <div class="chart-container">
                <canvas id="trafficChart"></canvas>
            </div>

            <h3 style="margin-bottom: 20px;">Top Domains</h3>
            <table>
                <thead>
                    <tr>
                        <th>Domain</th>
                        <th>Requests</th>
                        <th>Bandwidth</th>
                        <th>Hit Rate</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.domains || {}).map(([domain, d]) => {
        const dHitRate = d.totalRequests ? ((d.hits / d.totalRequests) * 100).toFixed(1) : 0;
        return `
                            <tr>
                                <td style="font-weight: 600;">${domain}</td>
                                <td>${d.totalRequests}</td>
                                <td>${formatBandwidth(d.bandwidth)}</td>
                                <td>${dHitRate}%</td>
                                <td><span style="color: var(--hit);">● Healthy</span></td>
                            </tr>
                        `;
    }).join('') || '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No traffic detected</td></tr>'}
                </tbody>
            </table>
        </div>

        <script>
            const history = ${historyData};
            
            const ctx = document.getElementById('trafficChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: history.map(p => new Date(p.timestamp).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'})),
                    datasets: [
                        {
                            label: 'Hits',
                            data: history.map(p => p.hits),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Misses',
                            data: history.map(p => p.misses),
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Blocked',
                            data: history.map(p => p.blocked),
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                        y: { 
                            grid: { color: 'rgba(255,255,255,0.05)' }, 
                            ticks: { color: '#94a3b8' },
                            beginAtZero: true
                        }
                    }
                }
            });

            // Polling for updates
            setTimeout(() => window.location.reload(), 10000);
        </script>
    </body>
    </html>
    `;
}
