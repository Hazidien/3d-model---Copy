// ==========================
// INIT MAP
// ==========================
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
    center: [112.796191, -7.280270],
    zoom: 15,
    pitch: 60,
    bearing: -20,
    antialias: true
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');


// ==========================
// POTENSI CONFIG oi
// ==========================
const potensiConfig = [
    {
        label: 'All Potensi',
        value: 'all',
        color: '#999999',
        description: 'Menampilkan seluruh kelas potensi'
    },
    {
        label: 'Sangat Tidak Potensial',
        value: 'Sangat Tidak Potensial',
        color: '#d73027',
        description: 'Sangat tidak layak'
    },
    {
        label: 'Tidak Potensial',
        value: 'Tidak Potensial',
        color: '#fc8d59',
        description: 'Kurang layak'
    },
    {
        label: 'Cukup Potensial',
        value: 'Cukup Potensial',
        color: '#fee08b',
        description: 'Cukup layak'
    },
    {
        label: 'Potensial',
        value: 'Potensial',
        color: '#91cf60',
        description: 'Layak'
    },
    {
        label: 'Sangat Potensial',
        value: 'Sangat Potensial',
        color: '#1a9850',
        description: 'Sangat layak'
    }
];


// ==========================
// UI LEGEND
// ==========================
const legend = document.getElementById('legend');
const descriptionBox = document.getElementById('description-box');

potensiConfig.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = `legend-item ${i === 0 ? 'active' : ''}`;
    item.onclick = () => filterPotensi(p, item);

    const color = document.createElement('span');
    color.className = 'legend-color';
    color.style.backgroundColor = p.value === 'all' ? 'transparent' : p.color;
    if (p.value === 'all') color.style.border = '1px solid #aaa';

    const label = document.createElement('span');
    label.innerText = p.label;

    item.appendChild(color);
    item.appendChild(label);
    legend.appendChild(item);
});

function filterPotensi(p, el) {
    document.querySelectorAll('.legend-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');

    descriptionBox.innerText = p.description;

    if (p.value === 'all') {
        map.setFilter('buildings-3d', null);
    } else {
        map.setFilter('buildings-3d', ['==', ['get', 'Potensi'], p.value]);
    }
    
}


// ==========================
// LOAD DATA & LAYER
// ==========================
map.on('load', () => {

    // === SOURCE ===
    map.addSource('una', {
        type: 'geojson',
        data: 'data/UNA_fix.geojson'
    });

        // Add Zoning Source
    map.addSource('zoning', {
        'type': 'geojson',
        'data': 'data/UNA_potensi.geojson'
    });

        // 1. Zoning Layer (Flat 2D)
    map.addLayer({
        'id': 'zoning-fill',
        'type': 'fill',
        'source': 'zoning',
        'paint': {
            'fill-color': [
                'match',
                ['get', 'Potensi'],
                'Sangat Tidak Potensial', '#d73027',
                'Tidak Potensial',        '#fc8d59',
                'Cukup Potensial',        '#fee08b',
                'Potensial',              '#91cf60',
                'Sangat Potensial',       '#1a9850',

                '#cccccc' // fallback
            ],
            'fill-opacity': 0.4
        }
    });

    // === 3D BUILDING ===
    map.addLayer({
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'una',
        paint: {
            'fill-extrusion-color': [
                'match',
                ['get', 'Potensi'],

                'Sangat Tidak Potensial', '#d73027',
                'Tidak Potensial',        '#fc8d59',
                'Cukup Potensial',        '#fee08b',
                'Potensial',              '#91cf60',
                'Sangat Potensial',       '#1a9850',

                '#cccccc' // fallback
            ],
            'fill-extrusion-height': [
                'coalesce',
                ['get', 'mean_heigh'],
                5
            ],
            'fill-extrusion-opacity': 0.9
        }
    });


    // ==========================
    // POPUP
    // ==========================
    map.on('click', 'buildings-3d', (e) => {
        const p = e.features[0].properties;

        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">Bangunan</div>
                <div class="popup-category">${p.Potensi}</div>
                <div class="popup-detail"><b>Mean Height:</b> ${p.mean_heigh ?? '-'}</div>
                <div class="popup-detail"><b>Nilai:</b> ${p.Nilai ?? '-'}</div>
                <div class="popup-detail"><b>Total:</b> ${p.Total ?? '-'}</div>
            `)
            .addTo(map);
    });

    map.on('mouseenter', 'buildings-3d', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'buildings-3d', () => {
        map.getCanvas().style.cursor = '';
    });
});
