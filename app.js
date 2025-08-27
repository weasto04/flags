// Minimal front-end app — no frameworks.
// Loads outputs/avg_colors.json and thumbnails from outputs/thumbnails

const K = 4;
const canvas = document.getElementById('plot');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const clustersDiv = document.getElementById('clusters');

let points = []; // {file, r,g,b, x,y,z}
let centroids = [];

// 3D view params
let rotX = -0.6, rotY = -0.6, zoom = 600;
let drag = false, lastX=0, lastY=0;
let hoveredPoint = null;
let selectedPoint = null;
const POINT_RADIUS = 6; // smaller marker radius

function loadJSON(url){
  return fetch(url).then(r=>r.json());
}

function project(p){
  // rotate around X and Y, then perspective project
  const rx = p.x;
  const ry = p.y * Math.cos(rotX) - p.z * Math.sin(rotX);
  const rz = p.y * Math.sin(rotX) + p.z * Math.cos(rotX);
  const sx = rx * Math.cos(rotY) - rz * Math.sin(rotY);
  const sz = rx * Math.sin(rotY) + rz * Math.cos(rotY);
  const f = zoom / (zoom + sz + 1);
  return {x: canvas.width/2 + sx * f, y: canvas.height/2 - ry * f, z: sz};
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw lines to centroids
  for(const pt of points){
    const proj = project(pt);
    const c = centroids[pt.cluster];
    if(!c) continue;
    const pc = project(c);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.2;
    ctx.moveTo(proj.x, proj.y);
    ctx.lineTo(pc.x, pc.y);
    ctx.stroke();
    ctx.lineWidth = 1.0;
  }

  // (axes removed)

  // draw points
  for(const pt of points){
    const p = project(pt);
    // cache screen projection for reliable hit testing
    pt._screen = p;
    ctx.beginPath();
    ctx.fillStyle = `rgb(${Math.round(pt.r*255)},${Math.round(pt.g*255)},${Math.round(pt.b*255)})`;
    ctx.arc(p.x, p.y, POINT_RADIUS, 0, Math.PI*2);
    ctx.fill();
    // cluster-colored outline for subtle grouping
    const CL_COLS = ['#e63946','#2a9d8f','#f4a261','#457b9d'];
    ctx.strokeStyle = CL_COLS[pt.cluster % CL_COLS.length] || '#222';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // highlight hovered or selected
    if(pt === hoveredPoint){
      ctx.beginPath(); ctx.arc(p.x, p.y, POINT_RADIUS + 4, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    }
    if(pt === selectedPoint){
      ctx.beginPath(); ctx.arc(p.x, p.y, POINT_RADIUS + 6, 0, Math.PI*2);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2.4; ctx.stroke();
    }
  // no text labels inside points (keep markers small)
  }

  // draw centroids as squares larger
  for(const c of centroids){
    const p = project(c);
    ctx.fillStyle = `rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;
    const s = 12;
    ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(p.x - s/2, p.y - s/2, s, s);
  }
    for(const c of centroids){
      const p = project(c);
      ctx.fillStyle = `rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;
      const s = 12;
      ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(p.x - s/2, p.y - s/2, s, s);
    }
  }

function drawAxes(){
  // axes from origin to positive extents
  const half = SCALE * 0.5;
  const origin = {x:0,y:0,z:0};
  const xEnd = {x: half, y:0, z:0};
  const yEnd = {x:0, y: half, z:0};
  const zEnd = {x:0, y:0, z: half};

  const po = project(origin);
  const px = project(xEnd);
  const py = project(yEnd);
  const pz = project(zEnd);

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  // X axis (red)
  ctx.beginPath(); ctx.moveTo(po.x, po.y); ctx.lineTo(px.x, px.y); ctx.stroke();
  ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(px.x, px.y, 4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.font = '12px sans-serif'; ctx.fillText('R (x)', px.x + 6, px.y + 4);
  // Y axis (green)
  ctx.beginPath(); ctx.moveTo(po.x, po.y); ctx.lineTo(py.x, py.y); ctx.stroke();
  ctx.fillStyle = 'green'; ctx.beginPath(); ctx.arc(py.x, py.y, 4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.fillText('G (y)', py.x + 6, py.y + 4);
  // Z axis (blue)
  ctx.beginPath(); ctx.moveTo(po.x, po.y); ctx.lineTo(pz.x, pz.y); ctx.stroke();
  ctx.fillStyle = 'blue'; ctx.beginPath(); ctx.arc(pz.x, pz.y, 4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.fillText('B (z)', pz.x + 6, pz.y + 4);
  ctx.restore();
}

function distance(a,b){
  return Math.pow(a.r-b.r,2)+Math.pow(a.g-b.g,2)+Math.pow(a.b-b.b,2);
}

function kmeans(data,k,iterations=50){
  // data: array of {r,g,b}
  // initialize centroids randomly
  const cs = [];
  const used = new Set();
  while(cs.length < k){
    const i = Math.floor(Math.random()*data.length);
    if(used.has(i)) continue;
    used.add(i);
    cs.push({...data[i]});
  }

  let assignments = new Array(data.length).fill(0);
  for(let it=0; it<iterations; it++){
    // assign
    let changed = false;
    for(let i=0;i<data.length;i++){
      let best=0, bd=Infinity;
      for(let j=0;j<k;j++){
        const d = distance(data[i], cs[j]);
        if(d<bd){bd=d; best=j}
      }
      if(assignments[i] !== best){ assignments[i] = best; changed = true }
    }
    // recompute
    const sums = Array.from({length:k},()=>({r:0,g:0,b:0,count:0}));
    for(let i=0;i<data.length;i++){
      const a = assignments[i];
      sums[a].r += data[i].r; sums[a].g += data[i].g; sums[a].b += data[i].b; sums[a].count++;
    }
    for(let j=0;j<k;j++){
      if(sums[j].count>0){ cs[j].r = sums[j].r / sums[j].count; cs[j].g = sums[j].g / sums[j].count; cs[j].b = sums[j].b / sums[j].count }
    }
    if(!changed) break;
  }
  return {centroids:cs, assignments};
}

function buildClusters(assignments){
  const cl = Array.from({length:K},()=>[]);
  for(let i=0;i<points.length;i++){
    const a = assignments[i];
    points[i].cluster = a;
    cl[a].push(points[i]);
  }
  // render list
  clustersDiv.innerHTML = '';
  for(let i=0;i<K;i++){
    const col = document.createElement('div'); col.className='cluster';
    const h = document.createElement('h3'); h.textContent = `Cluster ${i+1}`; col.appendChild(h);
    for(const m of cl[i]){
      const row = document.createElement('div'); row.className='member';
      const img = document.createElement('img'); img.src = `outputs/thumbnails/${m.file}`;
      const span = document.createElement('span'); span.textContent = m.file.replace('.png','');
      row.appendChild(img); row.appendChild(span); col.appendChild(row);
    }
    clustersDiv.appendChild(col);
  }
}

function findHover(canvasX, canvasY){
  // use cached screen coords (pt._screen) for hit testing
  let best = null;
  let bestDist = Infinity;
  const THR = 28; // pixels
  for(const pt of points){
    const p = pt._screen;
    if(!p) continue;
    const dx = p.x - canvasX, dy = p.y - canvasY;
    const dist2 = dx*dx + dy*dy;
    if(dist2 <= THR*THR){
      if(best === null || dist2 < bestDist || (dist2 === bestDist && p.z > best.p.z)){
        best = {pt, p}; bestDist = dist2;
      }
    }
  }
  return best;
}

// mouse interactions
canvas.addEventListener('mousedown', e=>{ drag=true; lastX=e.clientX; lastY=e.clientY });
canvas.addEventListener('mouseup', ()=>drag=false);
canvas.addEventListener('mouseleave', ()=>drag=false);
canvas.addEventListener('mousemove', e=>{
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (e.clientX - rect.left) * scaleX;
  const cy = (e.clientY - rect.top) * scaleY;
  if(drag){
    const dx = e.clientX - lastX; const dy = e.clientY - lastY;
    rotY += dx * 0.01; rotX += dy * 0.01; lastX = e.clientX; lastY = e.clientY; draw();
  }
  const hv = findHover(cx, cy);
  if(hv){
    hoveredPoint = hv.pt;
    const name = hoveredPoint.file.replace('.png','').replace(/_/g,' ');
    tooltip.classList.remove('hidden');
    tooltip.style.left = (e.pageX+12)+'px';
    tooltip.style.top = (e.pageY+12)+'px';
    tooltip.innerHTML = `<strong>${name}</strong>`;
  } else {
    hoveredPoint = null;
    tooltip.classList.add('hidden');
  }
  draw();
});

canvas.addEventListener('wheel', e=>{ e.preventDefault(); zoom += e.deltaY * 0.5; draw(); });

canvas.addEventListener('click', e=>{
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (e.clientX - rect.left) * scaleX;
  const cy = (e.clientY - rect.top) * scaleY;
  const hv = findHover(cx, cy);
  if(hv){
  selectedPoint = hv.pt;
  } else {
    selectedPoint = null;
  }
  draw();
});

// clear selection with Escape
window.addEventListener('keydown', e=>{
  if(e.key === 'Escape'){ selectedPoint = null; tooltip.classList.add('hidden'); draw() }
});

// tuning: scale the normalized RGB [0..1] values into a visible 3D range
const SCALE = 400; // default spread

// load data and run
loadJSON('outputs/avg_colors.json').then(arr=>{
  points = arr.map(a=>({file:a.file, r:a.r, g:a.g, b:a.b, x: (a.r - 0.5) * SCALE, y: (a.g - 0.5) * SCALE, z: (a.b - 0.5) * SCALE}));
  const data = points.map(p=>({r:p.r,g:p.g,b:p.b}));
  const res = kmeans(data, K, 100);
  centroids = res.centroids.map(c=>({r:c.r,g:c.g,b:c.b, x:(c.r-0.5)*SCALE, y:(c.g-0.5)*SCALE, z:(c.b-0.5)*SCALE}));
  buildClusters(res.assignments);
  draw();
}).catch(err=>{ console.error(err); alert('Failed to load outputs/avg_colors.json — run compute script') });
