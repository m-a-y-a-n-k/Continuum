export function renderAdminDashboard() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pravah Admin Control Center</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #0b0f19;
                --card-bg: #161c2d;
                --accent: #3b82f6;
                --accent-hover: #2563eb;
                --danger: #ef4444;
                --danger-hover: #dc2626;
                --text: #ffffff;
                --text-muted: #94a3b8;
                --border: rgba(255,255,255,0.05);
            }
            * { box-sizing: border-box; }
            body { 
                font-family: 'Outfit', sans-serif; 
                background: var(--bg); 
                color: var(--text); 
                margin: 0; 
                padding: 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 100vh;
            }
            .container { width: 100%; max-width: 900px; }
            
            /* Header */
            .header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 40px; 
                border-bottom: 1px solid var(--border);
                padding-bottom: 20px;
            }
            h1 { font-size: 2rem; margin: 0; background: linear-gradient(135deg, #60a5fa 0%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .nav-link { color: var(--text-muted); text-decoration: none; font-weight: 600; transition: color 0.2s; display: flex; align-items: center; gap: 8px; }
            .nav-link:hover { color: var(--accent); }

            /* Add Domain Card */
            .card { 
                background: var(--card-bg); 
                padding: 30px; 
                border-radius: 16px; 
                border: 1px solid var(--border);
                margin-bottom: 30px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            }
            .form-grid { display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: end; }
            .form-group { display: flex; flex-direction: column; gap: 8px; }
            label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
            input { 
                background: rgba(0,0,0,0.2); 
                border: 1px solid var(--border); 
                color: var(--text); 
                padding: 12px 16px; 
                border-radius: 8px; 
                font-family: inherit; 
                font-size: 1rem;
                transition: border-color 0.2s;
            }
            input:focus { outline: none; border-color: var(--accent); }
            
            button { 
                padding: 12px 24px; 
                border-radius: 8px; 
                border: none; 
                font-weight: 600; 
                cursor: pointer; 
                transition: all 0.2s; 
                font-size: 1rem;
            }
            .btn-primary { background: var(--accent); color: white; }
            .btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); }
            .btn-danger { background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 8px 16px; font-size: 0.9rem; }
            .btn-danger:hover { background: rgba(239, 68, 68, 0.2); }

            /* Domain List */
            .list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            h2 { font-size: 1.5rem; margin: 0; font-weight: 600; }
            
            .domain-list { display: flex; flex-direction: column; gap: 12px; }
            .domain-item { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                background: var(--card-bg); 
                padding: 20px 24px; 
                border-radius: 12px; 
                border: 1px solid var(--border);
                transition: transform 0.2s;
            }
            .domain-item:hover { border-color: rgba(255,255,255,0.1); }
            .domain-info { display: flex; flex-direction: column; gap: 4px; }
            .domain-host { font-weight: 600; font-size: 1.1rem; color: var(--text); }
            .domain-origin { font-size: 0.9rem; color: var(--text-muted); font-family: monospace; }
            .domain-status { 
                display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; margin-right: 8px; 
                box-shadow: 0 0 10px #10b981;
            }

            /* Toast */
            .toast {
                position: fixed; bottom: 30px; right: 30px; padding: 16px 24px; background: #334155; color: white;
                border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); transform: translateY(150%); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex; align-items: center; gap: 12px; z-index: 100;
            }
            .toast.show { transform: translateY(0); }
            .toast.success { background: #065f46; border-left: 4px solid #34d399; }
            .toast.error { background: #7f1d1d; border-left: 4px solid #f87171; }

            .empty-state { text-align: center; padding: 60px; color: var(--text-muted); font-style: italic; background: var(--card-bg); border-radius: 16px; border: 1px dashed var(--border); }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    <h1>Admin Control</h1>
                </div>
                <a href="/cdn-dashboard" class="nav-link" target="_blank">
                    Open Analytics Dashboard <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
            </div>

            <div class="card">
                <form id="addForm" class="form-grid">
                    <div class="form-group">
                        <label for="hostname">Tenant Domain</label>
                        <input type="text" id="hostname" placeholder="e.g. blog.client.com" required>
                    </div>
                    <div class="form-group">
                        <label for="origin">Origin URL</label>
                        <input type="url" id="origin" placeholder="e.g. https://wordpress-server.com" required>
                    </div>
                    <button type="submit" class="btn-primary">Add Tenant</button>
                </form>
            </div>

            <div class="list-header">
                <h2>Active Tenants</h2>
                <div id="countBadge" style="background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; color: var(--text-muted);">0 Active</div>
            </div>

            <div id="domainList" class="domain-list">
                <!-- Items will be injected here -->
                <div class="empty-state">Loading tenants...</div>
            </div>
        </div>

        <div id="toast" class="toast">
            <span id="toastMsg">Action successful</span>
        </div>

        <script>
            // --- API Client ---
            const API_URL = '/admin/domains';

            async function fetchDomains() {
                try {
                    const res = await fetch(API_URL);
                    const domains = await res.json();
                    renderList(domains);
                } catch (e) {
                    showToast('Failed to load domains', 'error');
                }
            }

            async function addDomain(hostname, origin) {
                try {
                    const res = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hostname, origin })
                    });
                    const data = await res.json();
                    
                    if (data.success) {
                        showToast(\`Successfully added \${hostname}\`, 'success');
                        document.getElementById('addForm').reset();
                        fetchDomains();
                    } else {
                        showToast(data.msg || 'Error adding domain', 'error');
                    }
                } catch (e) {
                    showToast('Network error', 'error');
                }
            }

            async function deleteDomain(hostname) {
                if(!confirm(\`Are you sure you want to remove \${hostname}?\`)) return;

                try {
                    const res = await fetch(API_URL, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hostname })
                    });
                    const data = await res.json();
                    
                    if (data.success) {
                        showToast(\`Removed \${hostname}\`, 'success');
                        fetchDomains();
                    } else {
                        showToast('Error removing domain', 'error');
                    }
                } catch (e) {
                    showToast('Network error', 'error');
                }
            }

            // --- UI Rendering ---
            function renderList(domains) {
                const listEl = document.getElementById('domainList');
                const countEl = document.getElementById('countBadge');
                const entries = Object.entries(domains);
                
                countEl.textContent = \`\${entries.length} Active\`;

                if (entries.length === 0) {
                    listEl.innerHTML = '<div class="empty-state">No tenants configured yet. Add one above.</div>';
                    return;
                }

                listEl.innerHTML = entries.map(([host, origin]) => \`
                    <div class="domain-item">
                        <div class="domain-info">
                            <div class="domain-host"><span class="domain-status"></span>\${host}</div>
                            <div class="domain-origin">Proxies to: \${origin}</div>
                        </div>
                        <button class="btn-danger" onclick="deleteDomain('\${host}')">Remove</button>
                    </div>
                \`).join('');
            }

            function showToast(msg, type = 'success') {
                const toast = document.getElementById('toast');
                const toastMsg = document.getElementById('toastMsg');
                
                toast.className = 'toast ' + type;
                toastMsg.innerText = msg;
                toast.classList.add('show');
                
                setTimeout(() => toast.classList.remove('show'), 3000);
            }

            // --- Event Listeners ---
            document.getElementById('addForm').addEventListener('submit', (e) => {
                e.preventDefault();
                const hostname = document.getElementById('hostname').value.trim();
                const origin = document.getElementById('origin').value.trim();
                if(hostname && origin) addDomain(hostname, origin);
            });

            // Initial Load
            fetchDomains();
        </script>
    </body>
    </html>
    `;
}
