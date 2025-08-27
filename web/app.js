// Minimal front-end app — no frameworks.
// Loads ../outputs/avg_colors.json and thumbnails from ../outputs/thumbnails

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
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.moveTo(proj.x, proj.y);
    ctx.lineTo(pc.x, pc.y);
    ctx.stroke();
  }

  // draw points
  for(const pt of points){
    const p = project(pt);
    ctx.beginPath();
    ctx.fillStyle = `rgb(${Math.round(pt.r*255)},${Math.round(pt.g*255)},${Math.round(pt.b*255)})`;
    ctx.arc(p.x, p.y, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    ctx.stroke();
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
      const img = document.createElement('img'); img.src = `../outputs/thumbnails/${m.file}`;
      const span = document.createElement('span'); span.textContent = m.file.replace('.png','');
      row.appendChild(img); row.appendChild(span); col.appendChild(row);
    }
    clustersDiv.appendChild(col);
  }
}

function findHover(mx,my){
  for(const pt of points){
    const p = project(pt);
    const dx = p.x - mx, dy = p.y - my;
    if(dx*dx+dy*dy <= 7*7) return {pt,p}
  }
  return null;
}

// mouse interactions
canvas.addEventListener('mousedown', e=>{ drag=true; lastX=e.offsetX; lastY=e.offsetY });
canvas.addEventListener('mouseup', ()=>drag=false);
canvas.addEventListener('mouseleave', ()=>drag=false);
canvas.addEventListener('mousemove', e=>{
  if(drag){
    const dx = e.offsetX - lastX; const dy = e.offsetY - lastY;
    rotY += dx * 0.01; rotX += dy * 0.01; lastX = e.offsetX; lastY = e.offsetY; draw();
  }
  const hv = findHover(e.offsetX,e.offsetY);
  if(hv){
    tooltip.classList.remove('hidden');
    tooltip.style.left = (e.pageX+12)+'px';
    tooltip.style.top = (e.pageY+12)+'px';
    tooltip.innerHTML = `<strong>${hv.pt.file.replace('.png','')}</strong>`;
  } else { tooltip.classList.add('hidden') }
});

canvas.addEventListener('wheel', e=>{ e.preventDefault(); zoom += e.deltaY * 0.5; draw(); });

// load data and run
loadJSON('../outputs/avg_colors.json').then(arr=>{
  points = arr.map(a=>({file:a.file, r:a.r, g:a.g, b:a.b, x: a.r - 0.5, y: a.g - 0.5, z: a.b - 0.5}));
  const data = points.map(p=>({r:p.r,g:p.g,b:p.b}));
  const res = kmeans(data, K, 100);
  centroids = res.centroids.map(c=>({r:c.r,g:c.g,b:c.b, x:c.r-0.5, y:c.g-0.5, z:c.b-0.5}));
  buildClusters(res.assignments);
  draw();
}).catch(err=>{ console.error(err); alert('Failed to load avg_colors.json — run compute script') });
