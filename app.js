// ============================================================
// WEBGIS POTENSI LOKASI HALTE iCAR ITS
// MapLibre GL JS — static GitHub Pages compatible
// ============================================================

const CENTER = [112.796191, -7.280270];
const DATA_BUILDINGS = 'data/UNA_fix.geojson';
const DATA_POTENSI = 'data/UNA_potensi.geojson';

const POTENSI = [
    { label: 'All Potensi', value: 'all', color: '#999999', description: 'Menampilkan seluruh kelas potensi.' },
    { label: 'Sangat Tidak Potensial', value: 'Sangat Tidak Potensial', color: '#d73027', description: 'Sangat tidak layak.' },
    { label: 'Tidak Potensial', value: 'Tidak Potensial', color: '#fc8d59', description: 'Kurang layak.' },
    { label: 'Cukup Potensial', value: 'Cukup Potensial', color: '#fee08b', description: 'Cukup layak.' },
    { label: 'Potensial', value: 'Potensial', color: '#91cf60', description: 'Layak.' },
    { label: 'Sangat Potensial', value: 'Sangat Potensial', color: '#1a9850', description: 'Sangat layak.' }
];

const legend = document.getElementById('legend');
const descriptionText = document.getElementById('description-text');
const loading = document.getElementById('loading');
const status = document.getElementById('map-status');

// ============================================================
// MAP STYLE
// Jangan bergantung pada Carto style JSON eksternal.
// Style minimal ini langsung menggunakan OSM raster tiles.
// ============================================================
const baseStyle = {
    version: 8,
    sources: {
        osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
        }
    },
    layers: [
        {
            id: 'osm-basemap',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
        }
    ]
};

const map = new maplibregl.Map({
    container: 'map',
    style: baseStyle,
    center: CENTER,
    zoom: 15.5,
    pitch: 45,
    bearing: -20,
    antialias: true,
    attributionControl: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

// ============================================================
// LEGEND
// ============================================================
POTENSI.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `legend-item ${index === 0 ? 'active' : ''}`;
    button.dataset.value = item.value;
    button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');

    const swatch = document.createElement('span');
    swatch.className = 'legend-color';
    swatch.style.backgroundColor = item.value === 'all' ? '#ffffff' : item.color;
    if (item.value === 'all') swatch.classList.add('all-swatch');

    const label = document.createElement('span');
    label.textContent = item.label;

    button.append(swatch, label);
    button.addEventListener('click', () => filterPotensi(item, button));
    legend.appendChild(button);
});

function filterPotensi(item, button) {
    document.querySelectorAll('.legend-item').forEach(el => {
        el.classList.remove('active');
        el.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    descriptionText.textContent = item.description;

    if (!map.getLayer('buildings-3d')) return;

    map.setFilter(
        'buildings-3d',
        item.value === 'all' ? null : ['==', ['get', 'Potensi'], item.value]
    );

    map.setFilter(
        'zoning-fill',
        item.value === 'all' ? null : ['==', ['get', 'Potensi'], item.value]
    );
}

// ============================================================
// DATA + LAYERS
// ============================================================
map.on('load', async () => {
    try {
        // Sources
        map.addSource('una', {
            type: 'geojson',
            data: DATA_BUILDINGS,
            promoteId: 'OBJECTID_1'
        });

        map.addSource('zoning', {
            type: 'geojson',
            data: DATA_POTENSI
        });

        // 2D potential overlay
        map.addLayer({
            id: 'zoning-fill',
            type: 'fill',
            source: 'zoning',
            paint: {
                'fill-color': [
                    'match', ['get', 'Potensi'],
                    'Sangat Tidak Potensial', '#d73027',
                    'Tidak Potensial', '#fc8d59',
                    'Cukup Potensial', '#fee08b',
                    'Potensial', '#91cf60',
                    'Sangat Potensial', '#1a9850',
                    '#cccccc'
                ],
                'fill-opacity': 0.28,
                'fill-outline-color': '#666666'
            }
        });

        // 3D buildings
        map.addLayer({
            id: 'buildings-3d',
            type: 'fill-extrusion',
            source: 'una',
            paint: {
                'fill-extrusion-color': [
                    'match', ['get', 'Potensi'],
                    'Sangat Tidak Potensial', '#d73027',
                    'Tidak Potensial', '#fc8d59',
                    'Cukup Potensial', '#fee08b',
                    'Potensial', '#91cf60',
                    'Sangat Potensial', '#1a9850',
                    '#cccccc'
                ],
                'fill-extrusion-height': [
                    'coalesce',
                    ['to-number', ['get', 'mean_heigh']],
                    5
                ],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.88
            }
        });

        // Put buildings above zoning overlay.
        map.moveLayer('buildings-3d');

        // Fit map to actual project data instead of relying only on a guessed center.
        const features = map.querySourceFeatures('una');
        if (features.length) {
            const bounds = new maplibregl.LngLatBounds();
            features.forEach(feature => addGeometryToBounds(feature.geometry, bounds));
            if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 90, maxZoom: 17, duration: 0 });
            }
        }

        // Popup
        map.on('click', 'buildings-3d', event => {
            const feature = event.features?.[0];
            if (!feature) return;
            const p = feature.properties || {};

            const safe = value => {
                const text = value === null || value === undefined || value === '' ? '-' : String(value);
                return text.replace(/[&<>"']/g, char => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
                }[char]));
            };

            new maplibregl.Popup({ maxWidth: '300px' })
                .setLngLat(event.lngLat)
                .setHTML(`
                    <div class="popup-title">Bangunan</div>
                    <div class="popup-category">${safe(p.Potensi)}</div>
                    <div class="popup-detail"><b>Mean Height:</b> ${safe(p.mean_heigh)}</div>
                    <div class="popup-detail"><b>Nilai:</b> ${safe(p.Nilai)}</div>
                    <div class="popup-detail"><b>Total:</b> ${safe(p.Total)}</div>
                    <div class="popup-detail"><b>Luas:</b> ${safe(p.Luas)}</div>
                `)
                .addTo(map);
        });

        map.on('mouseenter', 'buildings-3d', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'buildings-3d', () => {
            map.getCanvas().style.cursor = '';
        });

        loading.classList.add('hidden');
        status.textContent = 'Peta siap digunakan';
        setTimeout(() => status.classList.add('hidden'), 2500);
    } catch (error) {
        console.error('Gagal memuat WebGIS:', error);
        loading.classList.add('hidden');
        status.textContent = 'Gagal memuat data peta. Buka Console (F12) untuk detail.';
        status.classList.add('error');
    }
});

map.on('error', event => {
    console.error('MapLibre error:', event?.error || event);
});

function addGeometryToBounds(geometry, bounds) {
    if (!geometry) return;
    const coordinates = geometry.coordinates;

    const walk = value => {
        if (typeof value[0] === 'number') {
            bounds.extend([value[0], value[1]]);
            return;
        }
        value.forEach(walk);
    };

    walk(coordinates);
}
