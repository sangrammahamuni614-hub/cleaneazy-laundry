(() => {
  'use strict';
  const CONFIG = window.CLEANEAZY_CONFIG || { supabaseUrl: '', supabaseAnonKey: '', demoMode: true };
  const hasCloud = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  const KEYS = { data: 'cleaneazy.demo.data.v1', session: 'cleaneazy.auth.session.v1' };
  const STATUSES = ['pickup_requested','pickup_assigned','picked_up','processing','washing','ironing','quality_check','ready','out_for_delivery','delivered'];
  const STATUS = {pickup_requested:'पिकअप विनंती',pickup_assigned:'पिकअप नियुक्त',picked_up:'कपडे घेतले',processing:'प्रोसेसिंग',washing:'धुलाई',ironing:'इस्त्री',quality_check:'गुणवत्ता तपासणी',ready:'तयार',out_for_delivery:'डिलिव्हरीसाठी बाहेर',delivered:'डिलिव्हर झाले'};
  const METHOD = {cash:'रोख',upi:'UPI',card:'कार्ड',bank_transfer:'बँक ट्रान्सफर',other:'इतर'};
  const PAYMENT_STATE = {unpaid:'बाकी',partial:'अंशतः भरले',paid:'पूर्ण भरले'};
  const PAGE_NAMES = {dashboard:'डॅशबोर्ड',orders:'ऑर्डर्स',customers:'ग्राहक',services:'सेवा आणि दर',payments:'पेमेंट्स',subscriptions:'सदस्य योजना',reports:'अहवाल',whatsapp:'WhatsApp संदेश',backup:'बॅकअप आणि सेटिंग्ज'};
  const PLANS = [
    {code:'bachelor_basic',dbName:'Student / Bachelor Basic',name:'विद्यार्थी / बॅचलर बेसिक',amount:599,limit:5,period:'week',periodName:'आठवडा'},
    {code:'bachelor_premium',dbName:'Student / Bachelor Premium',name:'विद्यार्थी / बॅचलर प्रीमियम',amount:1199,limit:10,period:'week',periodName:'आठवडा'},
    {code:'dosti_yari',dbName:'Dosti Yari',name:'दोस्ती यारी',amount:1999,limit:50,period:'month',periodName:'महिना'},
    {code:'family_basic',dbName:'Basic Family',name:'बेसिक फॅमिली',amount:799,limit:7,period:'week',periodName:'आठवडा'},
    {code:'family_economy',dbName:'Family Economy',name:'फॅमिली इकॉनॉमी',amount:1199,limit:10,period:'week',periodName:'आठवडा'}
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const id = () => globalThis.crypto?.randomUUID?.() || `ce-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const dateInput = date => new Date(date).toISOString().slice(0, 10);
  const today = () => dateInput(new Date());
  const addDays = (date, amount) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + amount); return dateInput(d); };
  const money = value => new Intl.NumberFormat('mr-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(value)||0);
  const num = value => new Intl.NumberFormat('mr-IN',{maximumFractionDigits:2}).format(Number(value)||0);
  const dateFmt = value => value ? new Intl.DateTimeFormat('mr-IN',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : '—';
  const shortDate = value => value ? new Intl.DateTimeFormat('mr-IN',{day:'numeric',month:'short'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : '—';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalizePhone = value => { let digits = String(value||'').replace(/\D/g,''); if (digits.length === 10) digits = `91${digits}`; return digits; };
  const displayPhone = value => {if(!value)return '—';const digits=String(value).replace(/\D/g,'');return digits.length===10?`+91 ${esc(digits)}`:digits.startsWith('91')&&digits.length===12?`+91 ${esc(digits.slice(2))}`:`+${esc(digits)}`;};
  const serviceRateLabel = service => `${money(service.rate)} / ${service.unit === 'kg' ? 'किलो' : 'वस्तू'}`;
  const currentWeekStart = () => { const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return dateInput(d); };
  const currentMonthStart = () => `${today().slice(0,7)}-01`;
  let isDemo = true, data, currentPage = 'dashboard', session = null, toastTimer, deferredInstall = null;
  const page = $('#page-content');
  const modal = $('#app-modal');

  function freshDemo() {
    const day = today();
    const customers = [
      {id:'cust-01',code:'ग्राहक-००१',fullName:'अनन्या देशमुख',whatsapp:'919876540001',altNumber:'',address:'कोथरूड',area:'कोथरूड',customerType:'नियमित',notes:'पिकअपसाठी संध्याकाळी वेळ योग्य',active:true,createdAt:addDays(day,-60)},
      {id:'cust-02',code:'ग्राहक-००२',fullName:'रोहन कुलकर्णी',whatsapp:'919876540002',altNumber:'',address:'विमान नगर',area:'विमान नगर',customerType:'नियमित',notes:'',active:true,createdAt:addDays(day,-32)},
      {id:'cust-03',code:'ग्राहक-००३',fullName:'मीरा पाटील',whatsapp:'919876540003',altNumber:'',address:'बाणेर',area:'बाणेर',customerType:'सब्स्क्रिप्शन',notes:'',active:true,createdAt:addDays(day,-18)},
      {id:'cust-04',code:'ग्राहक-००४',fullName:'सिद्धार्थ जोशी',whatsapp:'919876540004',altNumber:'',address:'पाषाण',area:'पाषाण',customerType:'नियमित',notes:'',active:true,createdAt:addDays(day,-10)}
    ];
    const services = [
      {id:'srv-01',name:'धुलाई',unit:'kg',rate:80,category:'धुलाई',description:'साध्या कपड्यांची धुलाई',active:true},
      {id:'srv-02',name:'धुलाई + इस्त्री',unit:'kg',rate:110,category:'धुलाई',description:'धुलाई आणि इस्त्री',active:true},
      {id:'srv-03',name:'शर्ट / पँट',unit:'piece',rate:40,category:'कपडे',description:'प्रति वस्तू सेवा',active:true},
      {id:'srv-04',name:'ब्लँकेट',unit:'kg',rate:80,category:'घरगुती वस्तू',description:'ब्लँकेट धुलाई',active:true},
      {id:'srv-05',name:'बॅग / शूज',unit:'piece',rate:110,category:'विशेष निगा',description:'प्रति वस्तू स्वच्छता',active:true},
      {id:'srv-06',name:'ड्रायक्लीन साडी',unit:'piece',rate:160,category:'ड्रायक्लीनिंग',description:'विशेष निगेसह ड्रायक्लीनिंग',active:true},
      {id:'srv-07',name:'इतर कपडे',unit:'piece',rate:50,category:'कपडे',description:'प्रति वस्तू सेवा',active:true}
    ];
    const order = (n,cust,status,dayOffset,total,paid,service,qty,unit,rate,discount=0) => ({id:`ord-${n}`,number:`CE-२०२६-${String(n).padStart(4,'0')}`,invoice:`INV-२०२६-${String(n).padStart(4,'0')}`,customerId:cust,placedAt:addDays(day,dayOffset),deliveryAt:addDays(day,Math.max(dayOffset,0)+2),status,subtotal:total+discount,discount,total,paid,outstanding:total-paid,paymentStatus:paid<=0?'unpaid':paid>=total?'paid':'partial',notes:'',items:[{serviceId:service,name:services.find(s=>s.id===service).name,item:'कपडे',qty,unit,rate,amount:total+discount}]});
    const orders = [order(128,'cust-01','processing',0,704,300,'srv-02',6.4,'kg',110),order(127,'cust-02','ready',-1,320,320,'srv-06',2,'piece',160),order(126,'cust-03','out_for_delivery',0,800,0,'srv-01',10,'kg',80),order(125,'cust-04','delivered',-3,320,320,'srv-04',4,'kg',80),order(124,'cust-01','washing',-2,400,0,'srv-03',10,'piece',40),order(123,'cust-02','pickup_requested',-1,440,0,'srv-02',4,'kg',110)];
    const payments=[{id:'pay-01',orderId:'ord-128',amount:300,method:'upi',receivedAt:new Date().toISOString(),reference:'नमुना-००१'},{id:'pay-02',orderId:'ord-127',amount:320,method:'cash',receivedAt:new Date(Date.now()-86400000).toISOString(),reference:'नमुना-००२'},{id:'pay-03',orderId:'ord-125',amount:320,method:'card',receivedAt:new Date(Date.now()-3*86400000).toISOString(),reference:'नमुना-००३'}];
    const subscriptions=[{id:'sub-01',customerId:'cust-03',planCode:'bachelor_premium',startDate:addDays(day,-12),expiryDate:addDays(day,18),limit:10,period:'week',usedKg:10,monthlyAmount:1199,active:true}];
    return {customers,services,orders,payments,subscriptions,messages:[{id:'msg-01',event:'ऑर्डर तयार',recipient:'919876540001',status:'queued',attempts:0,createdAt:new Date().toISOString(),providerId:'',error:''}],settings:{businessName:'CleanEazy Laundry',location:'पुणे, महाराष्ट्र',currency:'INR'},rateHistory:[]};
  }
  function loadDemo() {
    try { const saved=JSON.parse(localStorage.getItem(KEYS.data)||'null'); if(saved && Array.isArray(saved.customers) && Array.isArray(saved.orders)) return saved; } catch(_) {}
    const starter=freshDemo(); localStorage.setItem(KEYS.data,JSON.stringify(starter)); return starter;
  }
  function persist() { if(isDemo) localStorage.setItem(KEYS.data,JSON.stringify(data)); }
  function toast(message, type='success') {
    const el=document.createElement('div'); el.className=`toast ${type==='error'?'error':type==='info'?'info':''}`; el.textContent=message; $('#toast-region').append(el);
    setTimeout(()=>el.remove(),4000);
  }
  function showLoginError(message) {
    let node=$('#login-error'); if(!node){node=document.createElement('div');node.id='login-error';node.className='form-error';$('#login-form').prepend(node);} node.textContent=message;
  }
  function openModal(title, body, kicker='माहिती') {
    $('#modal-title').textContent=title; $('#modal-kicker').textContent=kicker; $('#modal-body').innerHTML=body;
    if(!modal.open) modal.showModal();
  }
  function closeModal() { if(modal.open) modal.close(); }
  function setPage(next) {
    if(!PAGE_NAMES[next]) return; currentPage=next;
    $$('.side-nav [data-page]').forEach(button=>button.classList.toggle('active',button.dataset.page===next));
    $('#page-crumb').textContent=PAGE_NAMES[next];
    $('#sidebar').classList.remove('open'); $('#mobile-overlay').classList.remove('open');
    render(); window.scrollTo({top:0,behavior:'smooth'});
  }
  function render() {
    if(!data) return;
    const renderer={dashboard:renderDashboard,orders:renderOrders,customers:renderCustomers,services:renderServices,payments:renderPayments,subscriptions:renderSubscriptions,reports:renderReports,whatsapp:renderWhatsApp,backup:renderBackup}[currentPage];
    if(renderer) renderer();
    $('#order-nav-count').textContent=num(data.orders.filter(order=>order.status!=='delivered').length);
  }
  function customer(idValue) { return data.customers.find(item=>item.id===idValue); }
  function order(idValue) { return data.orders.find(item=>item.id===idValue); }
  function orderByNo(value) { return data.orders.find(item=>item.number===value||item.invoice===value); }
  function relatedPayments(orderId) { return data.payments.filter(payment=>payment.orderId===orderId); }
  function activeSubscriptions(customerId) { return data.subscriptions.filter(item=>item.active&&item.customerId===customerId&&item.expiryDate>=today()); }
  function statusPill(status) { return `<span class="status-pill status-${esc(status)}">${STATUS[status]||'अज्ञात'}</span>`; }
  function paymentPill(status) { return `<span class="payment-pill payment-${esc(status)}">${PAYMENT_STATE[status]||'बाकी'}</span>`; }
  function pageHeading(title, description, actions='') { return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`; }
  function btn(action,label,kind='primary',extra='') { return `<button type="button" class="${kind}-button" data-action="${esc(action)}" ${extra}>${label}</button>`; }
  function empty(title,description) { return `<div class="empty-state"><div class="empty-icon">◌</div><strong>${title}</strong>${description}</div>`; }
  function tableShell(title,tools,content,classes='') { return `<div class="table-card ${classes}"><div class="table-toolbar"><h2>${title}</h2>${tools||''}</div>${content}</div>`; }
  function orderRows(items) {
    if(!items.length) return empty('ऑर्डर उपलब्ध नाहीत','ऑर्डर जोडल्यानंतर त्या इथे दिसतील.');
    return `<div class="table-scroll"><table><thead><tr><th>ऑर्डर</th><th>ग्राहक</th><th>ऑर्डर तारीख</th><th>वितरण तारीख</th><th>स्थिती</th><th>एकूण</th><th>थकबाकी</th></tr></thead><tbody>${items.map(item=>{const c=customer(item.customerId);return `<tr class="clickable-row" data-action="order-detail" data-id="${esc(item.id)}"><td><div class="cell-main">${esc(item.number)}</div><div class="cell-sub">${esc(item.invoice)}</div></td><td><div class="cell-main">${esc(c?.fullName||'ग्राहक उपलब्ध नाही')}</div><div class="cell-sub">${displayPhone(c?.whatsapp)}</div></td><td>${dateFmt(item.placedAt)}</td><td>${dateFmt(item.deliveryAt)}</td><td>${statusPill(item.status)}</td><td class="amount">${money(item.total)}</td><td>${money(item.outstanding)}</td></tr>`}).join('')}</tbody></table></div>`;
  }
  function renderDashboard() {
    const day=today(), todayOrders=data.orders.filter(item=>item.placedAt===day), pending=data.orders.filter(item=>item.status!=='delivered'), countStatus=s=>data.orders.filter(item=>item.status===s).length;
    const sale=todayOrders.reduce((sum,item)=>sum+Number(item.total),0), collection=data.payments.filter(item=>String(item.receivedAt).slice(0,10)===day).reduce((sum,item)=>sum+Number(item.amount),0), outstanding=data.orders.reduce((sum,item)=>sum+Number(item.outstanding),0), openSubscriptions=data.subscriptions.filter(item=>item.active&&item.expiryDate>=day).length;
    const cards=[['आजच्या ऑर्डर्स',num(todayOrders.length),'आज नोंदवलेल्या ऑर्डर्स','▤',''],['प्रलंबित ऑर्डर्स',num(pending.length),'डिलिव्हरी बाकी','◷','warm'],['प्रोसेसिंग',num(countStatus('processing')+countStatus('washing')+countStatus('ironing')),'काम सुरू आहे','◌','warm'],['तयार',num(countStatus('ready')),'डिलिव्हरीसाठी तयार','✓',''],['डिलिव्हरीसाठी बाहेर',num(countStatus('out_for_delivery')),'ग्राहकापर्यंत जात आहे','↗',''],['पूर्ण झालेल्या ऑर्डर्स',num(countStatus('delivered')),'डिलिव्हर झालेल्या','✓',''],['आजची विक्री',money(sale),'ऑर्डरच्या एकूण रकमेवर आधारित','₹',''],['आजची वसुली',money(collection),'आज मिळालेले पेमेंट','₹','warm'],['एकूण थकबाकी',money(outstanding),'सर्व ऑर्डर्सची थकबाकी','!','alert'],['सक्रिय सब्स्क्रिप्शन',num(openSubscriptions),'वैध प्लॅन्स','◇','']];
    const max=Math.max(1,...Array.from({length:7},(_,i)=>data.orders.filter(o=>o.placedAt===addDays(day,i-6)).reduce((s,o)=>s+o.total,0)),...Array.from({length:7},(_,i)=>data.payments.filter(p=>String(p.receivedAt).slice(0,10)===addDays(day,i-6)).reduce((s,p)=>s+p.amount,0)));
    const chart=`<div class="chart">${Array.from({length:7},(_,i)=>{const date=addDays(day,i-6),sales=data.orders.filter(o=>o.placedAt===date).reduce((s,o)=>s+o.total,0),paid=data.payments.filter(p=>String(p.receivedAt).slice(0,10)===date).reduce((s,p)=>s+p.amount,0);return `<div class="chart-column"><div title="विक्री ${money(sales)} · वसुली ${money(paid)}" class="chart-bar alt" style="height:${Math.max(4,sales/max*92)}%"></div><div title="वसुली ${money(paid)}" class="chart-bar" style="height:${Math.max(paid?4:0,paid/max*92)}%"></div><span class="chart-label">${shortDate(date)}</span></div>`}).join('')}</div>`;
    const stages=['pickup_requested','processing','washing','ironing','quality_check','ready','out_for_delivery'];
    const maxStage=Math.max(1,...stages.map(countStatus));
    page.innerHTML=`${pageHeading('नमस्कार! 👋','आजच्या कामकाजाचा एकत्रित आढावा.',btn('new-order','＋ नवी ऑर्डर'))}<div class="stats-grid">${cards.map(([label,value,meta,icon,cls])=>`<article class="stat-card ${cls}"><span class="stat-icon">${icon}</span><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-meta">${meta}</div></article>`).join('')}</div><div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>विक्री आणि वसुली</h2><p>मागील सात दिवस · रुपये</p></div><a class="small-link" href="#" data-action="go-page" data-page="reports">सर्व अहवाल →</a></div>${chart}<div class="chart-legend"><span><i class="legend-dot"></i>वसुली</span><span><i class="legend-dot gold"></i>विक्री</span></div></section><section class="panel"><div class="panel-heading"><div><h2>स्थितीनुसार ऑर्डर्स</h2><p>सध्याचे कामकाज</p></div></div><div class="status-list">${stages.map(s=>`<div class="status-line"><span>${STATUS[s]}</span><div class="progress-track"><div class="progress-fill" style="width:${Math.max(2,countStatus(s)/maxStage*100)}%"></div></div><strong>${num(countStatus(s))}</strong></div>`).join('')}</div></section></div>${tableShell('अलीकडील ऑर्डर्स',`<a href="#" class="small-link" data-action="go-page" data-page="orders">सर्व ऑर्डर्स →</a>`,orderRows([...data.orders].sort((a,b)=>b.placedAt.localeCompare(a.placedAt)).slice(0,5)))}<div class="dashboard-grid"><section class="panel"><div class="panel-heading"><h2>सेवानुसार विक्री</h2><a href="#" class="small-link" data-action="go-page" data-page="reports">अहवाल →</a></div>${serviceSalesMarkup()}</section><section class="panel"><div class="panel-heading"><h2>लवकरच्या डिलिव्हरी</h2></div>${upcomingDeliveries()}</section></div>`;
  }
  function serviceSalesMarkup() {
    const totals={};data.orders.forEach(o=>(o.items||[]).forEach(i=>{const key=i.name||'सेवा';totals[key]=(totals[key]||0)+Number(i.amount||0)}));const rows=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,4);const max=Math.max(1,...rows.map(x=>x[1]));
    return rows.length?`<div class="bar-list">${rows.map(([name,value])=>`<div class="bar-row"><span>${esc(name)}</span><div class="progress-track"><div class="progress-fill" style="width:${value/max*100}%"></div></div><strong>${money(value)}</strong></div>`).join('')}</div>`:empty('विक्री उपलब्ध नाही','ऑर्डर नोंदवल्यावर सेवा-निहाय विक्री दिसेल.');
  }
  function upcomingDeliveries() {
    const list=[...data.orders].filter(o=>o.status!=='delivered').sort((a,b)=>a.deliveryAt.localeCompare(b.deliveryAt)).slice(0,4);
    return list.length?`<div class="status-list">${list.map(o=>`<div class="status-line" style="grid-template-columns:1fr auto"><span>${esc(customer(o.customerId)?.fullName||'ग्राहक')}<small style="display:block;color:#a0aaa2">${esc(o.number)}</small></span><strong>${dateFmt(o.deliveryAt)}</strong></div>`).join('')}</div>`:empty('डिलिव्हरी बाकी नाही','सर्व ऑर्डर्स पूर्ण आहेत.');
  }
  function renderOrders(filter='') {
    const q=filter.trim().toLowerCase();const list=[...data.orders].sort((a,b)=>b.placedAt.localeCompare(a.placedAt)).filter(o=>{const c=customer(o.customerId);return !q||[o.number,o.invoice,c?.fullName,c?.whatsapp,STATUS[o.status]].some(v=>String(v||'').toLowerCase().includes(q))});
    const controls=`<div class="toolbar-row"><select id="order-filter" aria-label="स्थितीनुसार ऑर्डर निवडा"><option value="">सर्व स्थिती</option>${STATUSES.map(s=>`<option value="${s}">${STATUS[s]}</option>`).join('')}</select><input id="order-search" placeholder="ऑर्डर शोधा" value="${esc(filter)}" aria-label="ऑर्डर शोधा"></div>`;
    page.innerHTML=`${pageHeading('ऑर्डर्स','ऑर्डर तयार करा, स्थिती पाहा आणि बिल उघडा.',btn('new-order','＋ नवी ऑर्डर'))}${tableShell(`सर्व ऑर्डर्स · ${num(list.length)}`,controls,orderRows(list),'orders-table')}`;
  }
  function renderCustomers(filter='') {
    const q=filter.trim().toLowerCase();const list=[...data.customers].filter(c=>!q||[c.fullName,c.whatsapp,c.area,c.code].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>a.fullName.localeCompare(b.fullName,'mr'));
    const tools=`<label class="toolbar-search"><span>⌕</span><input id="customer-search" value="${esc(filter)}" placeholder="नाव, क्रमांक, एरिया" aria-label="ग्राहक शोधा"></label>`;
    const content=list.length?`<div class="table-scroll"><table><thead><tr><th>ग्राहक</th><th>WhatsApp नंबर</th><th>एरिया</th><th>ग्राहक प्रकार</th><th>ऑर्डर्स</th><th>थकबाकी</th><th>स्थिती</th></tr></thead><tbody>${list.map(c=>{const orders=data.orders.filter(o=>o.customerId===c.id),bal=orders.reduce((s,o)=>s+Number(o.outstanding),0);return `<tr class="clickable-row" data-action="customer-detail" data-id="${esc(c.id)}"><td><div class="customer-cell"><span class="mini-avatar">${esc((c.fullName||'?').slice(0,1))}</span><div><div class="cell-main">${esc(c.fullName)}</div><div class="cell-sub">${esc(c.code)}</div></div></div></td><td>${displayPhone(c.whatsapp)}</td><td>${esc(c.area||'—')}</td><td>${esc(c.customerType||'नियमित')}</td><td>${num(orders.length)}</td><td class="amount">${money(bal)}</td><td>${c.active?'<span class="payment-pill payment-paid">सक्रिय</span>':'<span class="payment-pill payment-unpaid">बंद</span>'}</td></tr>`}).join('')}</tbody></table></div>`:empty('ग्राहक उपलब्ध नाहीत',q?'शोध बदलून पाहा.':'पहिला ग्राहक जोडण्यासाठी “ग्राहक जोडा” निवडा.');
    page.innerHTML=`${pageHeading('ग्राहक','ग्राहकांची माहिती, ऑर्डर इतिहास आणि थकबाकी.',btn('new-customer','＋ ग्राहक जोडा'))}${tableShell(`एकूण ग्राहक · ${num(list.length)}`,tools,content)}`;
  }
  function renderServices() {
    const list=[...data.services].sort((a,b)=>a.name.localeCompare(b.name,'mr'));
    page.innerHTML=`${pageHeading('सेवा आणि दर','दर बदलल्यावर जुन्या ऑर्डरमधील दर जसेच्या तसे राहतात.',btn('new-service','＋ सेवा जोडा'))}${list.length?`<div class="service-grid-app">${list.map(s=>`<article class="service-card-app"><div class="service-card-top"><span class="service-symbol">✳</span><button class="icon-action" data-action="edit-service" data-id="${esc(s.id)}" aria-label="${esc(s.name)} संपादित करा">✎</button></div><h3>${esc(s.name)}</h3><p>${esc(s.description||s.category||'सेवा')}</p><div class="service-rate">${money(s.rate)} <small>/ ${s.unit==='kg'?'किलो':'वस्तू'}</small></div><footer><span>${s.active?'सक्रिय सेवा':'बंद सेवा'}</span><button class="small-link" data-action="edit-service" data-id="${esc(s.id)}">दर बदला</button></footer></article>`).join('')}</div>`:empty('सेवा उपलब्ध नाहीत','सेवा जोडल्यानंतर येथे दिसतील.')}`;
  }
  function renderPayments() {
    const list=[...data.payments].sort((a,b)=>String(b.receivedAt).localeCompare(String(a.receivedAt)));
    const totalOutstanding=data.orders.reduce((s,o)=>s+Number(o.outstanding),0), collected=data.payments.reduce((s,p)=>s+Number(p.amount),0);
    const controls=`<div class="toolbar-row">${btn('new-payment','＋ पेमेंट नोंदवा','primary')}</div>`;
    const content=list.length?`<div class="table-scroll"><table><thead><tr><th>पेमेंट तारीख</th><th>ऑर्डर / बिल</th><th>ग्राहक</th><th>पद्धत</th><th>संदर्भ</th><th>रक्कम</th></tr></thead><tbody>${list.map(p=>{const o=order(p.orderId);return `<tr data-action="order-detail" data-id="${esc(p.orderId)}" class="clickable-row"><td>${dateFmt(String(p.receivedAt).slice(0,10))}</td><td><div class="cell-main">${esc(o?.number||'ऑर्डर उपलब्ध नाही')}</div><div class="cell-sub">${esc(o?.invoice||'')}</div></td><td>${esc(customer(o?.customerId)?.fullName||'—')}</td><td>${METHOD[p.method]||esc(p.method)}</td><td>${esc(p.reference||'—')}</td><td class="amount">${money(p.amount)}</td></tr>`}).join('')}</tbody></table></div>`:empty('पेमेंट नोंद नाही','पेमेंट नोंदवल्यावर व्यवहार येथे दिसेल.');
    page.innerHTML=`${pageHeading('पेमेंट्स','वसुली आणि ऑर्डरची थकबाकी वेगवेगळी पाहा.',btn('new-payment','＋ पेमेंट नोंदवा'))}<div class="report-grid"><div class="report-card"><span>एकूण वसुली</span><strong>${money(collected)}</strong><small>नोंदवलेल्या पेमेंट्सची बेरीज</small></div><div class="report-card"><span>एकूण थकबाकी</span><strong>${money(totalOutstanding)}</strong><small>ऑर्डर एकूण − भरलेले पेमेंट</small></div><div class="report-card"><span>नोंदवलेली पेमेंट्स</span><strong>${num(list.length)}</strong><small>प्रत्येक व्यवहार वेगळा नोंदवला आहे</small></div></div>${tableShell(`पेमेंट इतिहास · ${num(list.length)}`,controls,content)}`;
  }
  function weeklyUsage(sub) { if(sub.period==='month') return Number(sub.usedKg)||0; return Number(sub.usedKg)||0; }
  function addDemoSubscriptionUsage(customerId,items) {const sub=activeSubscriptions(customerId)[0];if(sub)sub.usedKg+=(items||[]).filter(item=>item.service.unit==='kg').reduce((sum,item)=>sum+Number(item.quantity),0);}
  function renderSubscriptions() {
    const list=[...data.subscriptions].sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate));
    page.innerHTML=`${pageHeading('सदस्य योजना','योजनेची मुदत आणि ऑर्डरमधून आपोआप मोजलेला किलो वापर.',btn('new-subscription','＋ योजना जोडा'))}${list.length?`<div class="subscription-grid">${list.map(s=>{const c=customer(s.customerId),used=weeklyUsage(s),remaining=Math.max(0,s.limit-used),plan=PLANS.find(p=>p.code===s.planCode),progress=Math.min(100,used/Math.max(1,s.limit)*100);return `<article class="subscription-card"><header><span class="plan-label">${esc(plan?.periodName||(s.period==='month'?'महिना':'आठवडा'))} मर्यादा</span><span class="payment-pill ${s.active&&s.expiryDate>=today()?'payment-paid':'payment-unpaid'}">${s.active&&s.expiryDate>=today()?'सक्रिय':'मुदत संपली'}</span></header><h3>${esc(c?.fullName||'ग्राहक')}</h3><div class="subscription-name">${esc(plan?.name||s.planCode)}</div><div class="sub-metrics"><span>वापरलेले<strong>${num(used)} किलो</strong></span><span>उर्वरित<strong>${num(remaining)} किलो</strong></span><span>मासिक रक्कम<strong>${money(s.monthlyAmount)}</strong></span></div><div class="sub-progress"><div style="width:${progress}%"></div></div><footer><span>${dateFmt(s.startDate)} – ${dateFmt(s.expiryDate)}</span><span>ऑर्डरमधून आपोआप</span></footer></article>`}).join('')}</div>`:empty('सदस्य योजना उपलब्ध नाही','ग्राहकाची योजना जोडल्यानंतर येथे दिसेल.')}`;
  }
  function renderReports() {
    const sales=data.orders.reduce((s,o)=>s+Number(o.total),0), collection=data.payments.reduce((s,p)=>s+Number(p.amount),0), outstanding=data.orders.reduce((s,o)=>s+Number(o.outstanding),0);
    const byService={};data.orders.forEach(o=>(o.items||[]).forEach(i=>byService[i.name]=(byService[i.name]||0)+Number(i.amount||0)));
    const serviceRows=Object.entries(byService).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...serviceRows.map(x=>x[1]));
    const salesMarkup=serviceRows.length?`<div class="bar-list">${serviceRows.map(([name,value])=>`<div class="bar-row"><span>${esc(name)}</span><div class="progress-track"><div class="progress-fill" style="width:${value/max*100}%"></div></div><strong>${money(value)}</strong></div>`).join('')}</div>`:empty('विक्री उपलब्ध नाही','ऑर्डर नोंदवल्यावर येथे दिसेल.');
    const businessMarkup=`<ul class="security-list"><li><span>✓</span>ग्राहक: ${num(data.customers.length)}</li><li><span>✓</span>एकूण ऑर्डर्स: ${num(data.orders.length)}</li><li><span>✓</span>सक्रिय सेवा: ${num(data.services.filter(s=>s.active).length)}</li><li><span>✓</span>सक्रिय सदस्य योजना: ${num(data.subscriptions.filter(s=>s.active).length)}</li></ul>`;
    const cards=`<div class="report-grid"><div class="report-card"><span>एकूण विक्री</span><strong>${money(sales)}</strong><small>ऑर्डरची एकूण रक्कम</small></div><div class="report-card"><span>एकूण वसुली</span><strong>${money(collection)}</strong><small>प्रत्यक्ष नोंदवलेली पेमेंट्स</small></div><div class="report-card"><span>एकूण थकबाकी</span><strong>${money(outstanding)}</strong><small>एकूण विक्री − भरलेली रक्कम</small></div></div>`;
    const panels=`<div class="dashboard-grid"><section class="panel"><div class="panel-heading"><h2>सेवानुसार विक्री</h2></div>${salesMarkup}</section><section class="panel"><div class="panel-heading"><h2>व्यवसायाचा आढावा</h2></div>${businessMarkup}</section></div>`;
    const orderTable=tableShell(`ऑर्डर अहवाल · ${num(data.orders.length)}`,'',orderRows([...data.orders].sort((a,b)=>b.placedAt.localeCompare(a.placedAt))));
    page.innerHTML=`${pageHeading('अहवाल','विक्री म्हणजे ऑर्डरची एकूण रक्कम; वसुली म्हणजे प्रत्यक्ष मिळालेले पेमेंट.','<button class="secondary-button" data-action="export-report">↓ CSV डाउनलोड</button>')}${cards}${panels}${orderTable}`;
  }  function renderWhatsApp() {
    const list=[...(data.messages||[])].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    const rows=list.length?`<div class="table-scroll"><table><thead><tr><th>वेळ</th><th>सूचना प्रकार</th><th>प्राप्तकर्ता</th><th>स्थिती</th><th>प्रयत्न</th><th>प्रदाता संदेश क्रमांक</th></tr></thead><tbody>${list.map(m=>`<tr><td>${dateFmt(String(m.createdAt||'').slice(0,10))}</td><td>${esc(m.event||'संदेश')}</td><td>${displayPhone(m.recipient)}</td><td><span class="message-state ${['sent','delivered','read'].includes(m.status)?'sent':m.status==='failed'?'failed':''}">${messageStatus[m.status]||'रांगेत'}</span>${m.error?`<div class="cell-sub">${esc(m.error)}</div>`:''}</td><td>${num(m.attempts||0)}</td><td>${esc(m.providerId||'—')}</td></tr>`).join('')}</tbody></table></div>`:empty('संदेश रांगेत नाहीत','ऑर्डरच्या सूचना येथे रांगेत जोडल्या जातील.');
    page.innerHTML=`${pageHeading('WhatsApp संदेश','WhatsApp Cloud API द्वारे संदेश पाठवण्याची रांग आणि स्थिती.',btn('refresh','↻ अद्ययावत करा','secondary'))}<div class="mode-note" style="margin-bottom:14px"><span class="mode-dot"></span><span>${isDemo?'नमुना संदेश फक्त सरावासाठी आहेत; प्रत्यक्ष WhatsApp संदेश जात नाहीत.':'ऑनलाइन संदेश रांगेतील संदेश आणि पाठवण्याची स्थिती येथे दिसते.'}</span></div>${tableShell(`संदेश रांग · ${num(list.length)}`,'',rows)}`;
  }
  function renderBackup() {
    const last=localStorage.getItem('cleaneazy.last.backup')||'';
    page.innerHTML=`${pageHeading('बॅकअप आणि सेटिंग्ज','डेटाची JSON प्रत जतन करा; परत आणण्याआधी संपूर्ण फाइल तपासली जाईल.')}
      <div class="backup-grid"><article class="backup-card"><div class="backup-icon">↓</div><h2>पूर्ण बॅकअप डाउनलोड</h2><p>ग्राहक, सेवा, ऑर्डर्स, पेमेंट्स, सदस्य योजना, सूचना, दर इतिहास आणि व्यवसाय सेटिंग्ज.</p><button class="secondary-button" data-action="backup-export">JSON बॅकअप डाउनलोड</button><p>शेवटचा बॅकअप: ${last?dateFmt(last):'अद्याप नाही'}</p></article><article class="backup-card"><div class="backup-icon">↑</div><h2>बॅकअपमधून डेटा परत आणा</h2><p>योग्य CleanEazy बॅकअप तपासून एकाच डेटाबेस व्यवहारात डेटा परत आणला जाईल.</p><label class="secondary-button" for="backup-file">JSON फाइल निवडा</label><input id="backup-file" type="file" accept="application/json,.json" hidden></article><article class="backup-card"><div class="backup-icon">◈</div><h2>जोडणी स्थिती</h2><p>${isDemo?'सध्या नमुना सराव मोड. डेटा फक्त या ब्राउझरच्या स्थानिक साठवणीत आहे.':'Supabase ऑनलाइन जोडणी वापरली जात आहे.'}</p><ul class="security-list"><li><span>✓</span>${isDemo?'फक्त नमुना डेटा':'सुरक्षित सत्र वापरले जात आहे'}</li><li><span>✓</span>सेवा-गुपित ब्राउझरमध्ये नाही</li><li><span>${isDemo?'○':'✓'}</span>${isDemo?'ऑनलाइन जोडणी उपलब्ध':'लॉगिन केलेल्या कर्मचाऱ्यास डेटाबेस प्रवेश'}</li></ul></article><article class="backup-card"><div class="backup-icon">⚙</div><h2>व्यवसाय माहिती</h2><div class="field"><label>व्यवसायाचे नाव</label><input value="${esc(data.settings?.businessName||'CleanEazy Laundry')}" disabled></div><div class="field" style="margin-top:10px"><label>व्यवसायाचे ठिकाण</label><input value="${esc(data.settings?.location||'पुणे, महाराष्ट्र')}" disabled></div><p>ही माहिती येथे दाखवली आहे.</p></article></div>`;
  }
  function customerDetail(customerId) {
    const c=customer(customerId); if(!c) return;
    const list=data.orders.filter(o=>o.customerId===c.id).sort((a,b)=>b.placedAt.localeCompare(a.placedAt));
    const balance=list.reduce((s,o)=>s+Number(o.outstanding),0), payments=list.flatMap(o=>relatedPayments(o.id));
    openModal(c.fullName,`<div class="detail-grid"><section><div class="summary-box" style="padding:14px"><div class="cell-main">${esc(c.code)}</div><p>${displayPhone(c.whatsapp)}</p><p>${esc(c.address||'पत्ता उपलब्ध नाही')}${c.area?` · ${esc(c.area)}`:''}</p><p>${esc(c.customerType||'नियमित')} · ${c.active?'सक्रिय':'बंद'}</p>${c.notes?`<p>${esc(c.notes)}</p>`:''}<button type="button" class="secondary-button" data-action="edit-customer" data-id="${esc(c.id)}">माहिती संपादित करा</button></div><div class="summary-box" style="padding:14px;margin-top:12px"><div class="cell-sub">एकूण थकबाकी</div><div class="stat-value">${money(balance)}</div><div class="cell-sub">एकूण पेमेंट्स · ${num(payments.length)}</div></div></section><section>${tableShell(`ऑर्डर इतिहास · ${num(list.length)}`,'',list.length?`<div class="table-scroll"><table><thead><tr><th>ऑर्डर</th><th>तारीख</th><th>स्थिती</th><th>एकूण</th></tr></thead><tbody>${list.map(o=>`<tr class="clickable-row" data-action="order-detail" data-id="${esc(o.id)}"><td>${esc(o.number)}</td><td>${shortDate(o.placedAt)}</td><td>${statusPill(o.status)}</td><td>${money(o.total)}</td></tr>`).join('')}</tbody></table></div>`:empty('ऑर्डर इतिहास नाही',''))}</section></div>`,'ग्राहक प्रोफाइल');
  }
  function orderDetail(orderId) {
    const o=order(orderId);if(!o)return;const c=customer(o.customerId),idx=STATUSES.indexOf(o.status),payments=relatedPayments(o.id),next=STATUSES[idx+1];
    const timeline=STATUSES.map((s,i)=>`<div class="timeline-step ${i<idx?'done':i===idx?'current':''}">${STATUS[s]}</div>`).join('');
    const items=`<div class="table-scroll"><table><thead><tr><th>सेवा / वस्तू</th><th>प्रमाण</th><th>दर</th><th>रक्कम</th></tr></thead><tbody>${(o.items||[]).map(i=>`<tr><td><div class="cell-main">${esc(i.name)}</div><div class="cell-sub">${esc(i.item||'')}</div></td><td>${num(i.qty)} ${i.unit==='kg'?'किलो':'वस्तू'}</td><td>${money(i.rate)}</td><td class="amount">${money(i.amount)}</td></tr>`).join('')}</tbody></table></div>`;
    const paymentContent=payments.length?payments.map(p=>`<div class="status-line" style="grid-template-columns:1fr auto"><span>${METHOD[p.method]||esc(p.method)} · ${shortDate(String(p.receivedAt).slice(0,10))}</span><strong>${money(p.amount)}</strong></div>`).join(''):empty('पेमेंट नोंद नाही','');
    const progressButton=next?`<button type="button" class="primary-button" data-action="advance-order" data-id="${esc(o.id)}">पुढचा टप्पा: ${STATUS[next]} →</button>`:'<span class="payment-pill payment-paid">ऑर्डर पूर्ण</span>';
    const actions=`<div class="heading-actions invoice-action" style="margin:12px 0 0">${progressButton}<button type="button" class="secondary-button" data-action="add-order-payment" data-id="${esc(o.id)}">पेमेंट नोंदवा</button><button type="button" class="plain-button" data-action="invoice" data-id="${esc(o.id)}">बिल / PDF</button></div>`;
    openModal(`ऑर्डर ${o.number}`,`<div class="invoice-sheet"><div class="invoice-brand"><div><h2>CleanEazy Laundry</h2><p>पुणे, महाराष्ट्र</p></div><div class="invoice-number">${esc(o.invoice)}<br>${dateFmt(o.placedAt)}</div></div><div class="invoice-customer"><div>ग्राहक<br><strong>${esc(c?.fullName||'—')}</strong><br>${displayPhone(c?.whatsapp)}<br>${esc(c?.address||'')}</div><div>अपेक्षित डिलिव्हरी<br><strong>${dateFmt(o.deliveryAt)}</strong><br>${statusPill(o.status)}</div></div><div class="order-timeline">${timeline}</div>${items}<div class="invoice-totals"><div><span>उपएकूण</span><strong>${money(o.subtotal)}</strong></div><div><span>सवलत</span><strong>− ${money(o.discount)}</strong></div><div class="total"><span>एकूण</span><strong>${money(o.total)}</strong></div><div><span>भरलेली रक्कम</span><strong>${money(o.paid)}</strong></div><div><span>थकबाकी</span><strong>${money(o.outstanding)}</strong></div><div><span>पेमेंट स्थिती</span><strong>${PAYMENT_STATE[o.paymentStatus]}</strong></div></div><p class="cell-sub" style="margin-top:14px">${o.notes?`नोंद: ${esc(o.notes)}`:'कपड्यांच्या सेवेसाठी धन्यवाद.'}</p></div>${actions}<div style="margin-top:18px"><div class="panel-heading"><h2>पेमेंट इतिहास</h2></div>${paymentContent}</div>`,'ऑर्डर तपशील');
  }
  function customerForm(existing) {
    const c=existing||{};openModal(existing?'ग्राहक माहिती संपादित करा':'नवीन ग्राहक','<div id="dynamic-form"></div>','ग्राहक');
    $('#dynamic-form').innerHTML=`<div class="form-grid"><div class="field full"><label for="f-name">पूर्ण नाव *</label><input id="f-name" value="${esc(c.fullName||'')}" maxlength="120" required></div><div class="field"><label for="f-phone">WhatsApp नंबर *</label><input id="f-phone" type="tel" value="${esc(c.whatsapp||'')}" inputmode="tel" placeholder="१० अंकी मोबाइल नंबर" required><small>देश कोड आपोआप जोडला जाईल.</small></div><div class="field"><label for="f-alt">पर्यायी नंबर</label><input id="f-alt" type="tel" value="${esc(c.altNumber||'')}" inputmode="tel"></div><div class="field full"><label for="f-address">पत्ता *</label><input id="f-address" value="${esc(c.address||'')}" maxlength="250" required></div><div class="field"><label for="f-area">एरिया</label><input id="f-area" value="${esc(c.area||'')}" maxlength="80"></div><div class="field"><label for="f-type">ग्राहक प्रकार</label><select id="f-type"><option ${c.customerType==='नियमित'?'selected':''}>नियमित</option><option ${c.customerType==='सब्स्क्रिप्शन'?'selected':''}>सब्स्क्रिप्शन</option><option ${c.customerType==='व्यवसाय'?'selected':''}>व्यवसाय</option></select></div><div class="field full"><label for="f-notes">नोंदी</label><textarea id="f-notes" maxlength="1000">${esc(c.notes||'')}</textarea></div>${existing?`<div class="field full"><label><input id="f-active" type="checkbox" ${c.active?'checked':''}> ग्राहक सक्रिय</label></div>`:''}</div><div id="form-error"></div><div class="modal-actions"><button type="button" class="plain-button" data-action="close-modal">रद्द करा</button><button type="button" class="primary-button" data-action="save-customer" data-id="${esc(c.id||'')}">जतन करा</button></div>`;
  }
  function serviceForm(existing) {
    const s=existing||{};openModal(existing?'सेवा आणि दर संपादित करा':'नवीन सेवा','<div id="dynamic-form"></div>','सेवा आणि दर');
    $('#dynamic-form').innerHTML=`<div class="form-grid"><div class="field full"><label for="f-name">सेवेचे नाव *</label><input id="f-name" value="${esc(s.name||'')}" maxlength="120" required></div><div class="field"><label for="f-rate">दर (₹) *</label><input id="f-rate" type="number" min="0.01" step="0.01" value="${esc(s.rate??'')}" required></div><div class="field"><label for="f-unit">एकक *</label><select id="f-unit"><option value="kg" ${s.unit==='kg'?'selected':''}>किलो</option><option value="piece" ${s.unit==='piece'?'selected':''}>वस्तू</option></select></div><div class="field"><label for="f-category">विभाग</label><input id="f-category" value="${esc(s.category||'सामान्य')}" maxlength="80"></div><div class="field"><label for="f-description">वर्णन</label><input id="f-description" value="${esc(s.description||'')}" maxlength="200"></div>${existing?`<div class="field full"><label><input id="f-active" type="checkbox" ${s.active?'checked':''}> सेवा सक्रिय</label></div>`:''}</div><div id="form-error"></div><div class="modal-actions"><button type="button" class="plain-button" data-action="close-modal">रद्द करा</button><button type="button" class="primary-button" data-action="save-service" data-id="${esc(s.id||'')}">जतन करा</button></div>`;
  }
  function addOrderItemRow(serviceId='') {
    const target=$('#order-items');if(!target)return;const row=document.createElement('div');row.className='form-grid order-item-row';row.style.cssText='grid-template-columns:1.1fr .7fr 1.1fr auto;align-items:end;padding:10px 0;border-bottom:1px solid #edf0ec';
    row.innerHTML=`<div class="field"><label>सेवा *</label><select class="item-service"><option value="">सेवा निवडा</option>${data.services.filter(s=>s.active).map(s=>`<option value="${esc(s.id)}" ${s.id===serviceId?'selected':''}>${esc(s.name)} · ${money(s.rate)}</option>`).join('')}</select></div><div class="field"><label>प्रमाण *</label><input class="item-quantity" type="number" min="0.01" step="0.01" value="1"></div><div class="field"><label>वस्तू / नोंद</label><input class="item-name" maxlength="80" placeholder="उदा. शर्ट, साडी"></div><button type="button" class="icon-action remove-item" aria-label="सेवा काढा">×</button>`;target.append(row);
  }
  function subscriptionForm() {
    const customers=data.customers.filter(c=>c.active);openModal('नवीन सब्स्क्रिप्शन','<div id="dynamic-form"></div>','सब्स्क्रिप्शन');
    $('#dynamic-form').innerHTML=`<div class="form-grid"><div class="field full"><label for="f-customer">ग्राहक *</label><select id="f-customer"><option value="">ग्राहक निवडा</option>${customers.map(c=>`<option value="${esc(c.id)}">${esc(c.fullName)}</option>`).join('')}</select></div><div class="field full"><label for="f-plan">प्लॅन *</label><select id="f-plan"><option value="">प्लॅन निवडा</option>${PLANS.map(p=>`<option value="${p.code}">${esc(p.name)} · ${money(p.amount)} / महिना · ${num(p.limit)} किलो / ${p.periodName}</option>`).join('')}</select></div><div class="field"><label for="f-start">सुरुवातीची तारीख *</label><input id="f-start" type="date" value="${today()}"></div><div class="field"><label for="f-expiry">मुदत संपण्याची तारीख *</label><input id="f-expiry" type="date" value="${addDays(today(),30)}"></div></div><div id="form-error"></div><div class="modal-actions"><button type="button" class="plain-button" data-action="close-modal">रद्द करा</button><button type="button" class="primary-button" data-action="save-subscription">सब्स्क्रिप्शन जोडा</button></div>`;
  }
  function orderForm() {
    const customers=data.customers.filter(c=>c.active);openModal('नवी ऑर्डर तयार करा','<div id="dynamic-form"></div>','ऑर्डर');
    $('#dynamic-form').innerHTML=`<div class="form-grid"><div class="field full"><label for="order-customer">ग्राहक *</label><select id="order-customer"><option value="">ग्राहक निवडा</option>${customers.map(c=>`<option value="${esc(c.id)}">${esc(c.fullName)} · ${displayPhone(c.whatsapp)}</option>`).join('')}</select></div><div class="field"><label for="order-date">ऑर्डर तारीख</label><input id="order-date" type="date" value="${today()}" readonly></div><div class="field"><label for="order-delivery">अपेक्षित डिलिव्हरी *</label><input id="order-delivery" type="date" value="${addDays(today(),2)}"></div><div class="field full"><label>ऑर्डर सेवा</label><div id="order-items"></div><button type="button" class="small-link" data-action="add-item" style="margin-top:8px">＋ आणखी सेवा जोडा</button></div><div class="field full"><small>नवीन ग्राहकाच्या पहिल्या ऑर्डरवर २५% स्वागत सवलत आपोआप लागू होईल. सक्रिय सदस्य योजनेतील किलो वापर ऑर्डरमधून मोजला जातो.</small></div><div class="field"><label for="order-discount">अतिरिक्त सवलत (₹)</label><input id="order-discount" type="number" min="0" step="0.01" value="0"></div><div class="field"><label for="order-notes">नोंदी</label><input id="order-notes" maxlength="500"></div></div><div class="summary-box" id="order-total-preview" style="margin-top:13px;padding:12px;font-size:10px">एकूण रक्कम: ${money(0)}</div><div id="form-error"></div><div class="modal-actions"><button type="button" class="plain-button" data-action="close-modal">रद्द करा</button><button type="button" class="primary-button" data-action="save-order" data-idempotency="${id()}">ऑर्डर तयार करा</button></div>`;addOrderItemRow();
  }
  function paymentForm(preselect='') {
    const orders=data.orders.filter(o=>o.outstanding>0);openModal('पेमेंट नोंदवा','<div id="dynamic-form"></div>','पेमेंट');
    $('#dynamic-form').innerHTML=`<div class="form-grid"><div class="field full"><label for="pay-order">ऑर्डर *</label><select id="pay-order"><option value="">ऑर्डर निवडा</option>${orders.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===String(preselect)?'selected':''}>${esc(o.number)} · ${esc(customer(o.customerId)?.fullName||'')} · थकबाकी ${money(o.outstanding)}</option>`).join('')}</select></div><div class="field"><label for="pay-amount">पेमेंट रक्कम (₹) *</label><input id="pay-amount" type="number" min="0.01" step="0.01" placeholder="रक्कम"></div><div class="field"><label for="pay-method">पद्धत *</label><select id="pay-method"><option value="cash">रोख</option><option value="upi">UPI</option><option value="card">कार्ड</option><option value="bank_transfer">बँक ट्रान्सफर</option><option value="other">इतर</option></select></div><div class="field full"><label for="pay-reference">व्यवहार संदर्भ</label><input id="pay-reference" maxlength="120" placeholder="पर्यायी"></div></div><div id="form-error"></div><div class="modal-actions"><button type="button" class="plain-button" data-action="close-modal">रद्द करा</button><button type="button" class="primary-button" data-action="save-payment" data-idempotency="${id()}" data-payment-date="${new Date().toISOString()}">पेमेंट नोंदवा</button></div>`;
  }
  function showFormError(message) { const target=$('#form-error');if(target)target.innerHTML=`<div class="form-error">${esc(message)}</div>`; }
  function customerHasPriorOrder(customerId) { return data.orders.some(item=>String(item.customerId)===String(customerId)); }
  function welcomeDiscountFor(customerId,subtotal) { return customerId&&!customerHasPriorOrder(customerId)?Math.round((subtotal*0.25+Number.EPSILON)*100)/100:0; }
  function localOrderTotal() {
    let subtotal=0;$$('.order-item-row').forEach(row=>{const service=data.services.find(s=>String(s.id)===$('.item-service',row)?.value),quantity=Number($('.item-quantity',row)?.value)||0;subtotal+=Number(service?.rate||0)*quantity;});
    const customerId=$('#order-customer')?.value,offer=welcomeDiscountFor(customerId,subtotal),manual=Number($('#order-discount')?.value)||0,discount=offer+manual;$('#order-total-preview').textContent=`उपएकूण: ${money(subtotal)} · स्वागत सवलत: ${money(offer)} · अतिरिक्त सवलत: ${money(manual)} · एकूण: ${money(Math.max(0,subtotal-discount))}`;
  }
  function updateOrderSubscriptions() { localOrderTotal(); }
  function updatePaymentMax() { const select=$('#pay-order'),amount=$('#pay-amount');if(!select||!amount)return;const o=order(select.value);if(o){amount.max=String(o.outstanding);amount.placeholder=`कमाल ${money(o.outstanding)}`;} }
  function makeMessage(event,recipient) { if(!data.messages)data.messages=[];if(recipient)data.messages.unshift({id:id(),event,recipient,status:'queued',attempts:0,createdAt:new Date().toISOString(),providerId:'',error:''}); }
  function updateOrderTotals(o) { o.outstanding=Math.max(0,Number(o.total)-Number(o.paid));o.paymentStatus=o.outstanding<=0?'paid':o.paid>0?'partial':'unpaid'; }
  async function fetchCloud(path, options={}) {
    const base=String(CONFIG.supabaseUrl).replace(/\/$/,''),access=session?.access_token||'';
    const response=await fetch(`${base}${path}`,{...options,headers:{apikey:CONFIG.supabaseAnonKey,Authorization:`Bearer ${access||CONFIG.supabaseAnonKey}`,'Content-Type':'application/json',...(options.headers||{})}});
    const text=await response.text();let body=null;try{body=text?JSON.parse(text):null;}catch(_){body=text;}
    if(!response.ok){const error=new Error(body?.message||body?.msg||body?.error_description||body?.hint||'जोडणी अयशस्वी');error.status=response.status;throw error;}return body;
  }
  async function cloudLogin(email,password) {
    const response=await fetch(`${String(CONFIG.supabaseUrl).replace(/\/$/,'')}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:CONFIG.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.msg||body.message||body.error_description||'लॉगिन माहिती तपासा.');session=body;localStorage.setItem(KEYS.session,JSON.stringify(session));
  }
  async function refreshCloudSession() {
    if(!session?.refresh_token)return false;const response=await fetch(`${String(CONFIG.supabaseUrl).replace(/\/$/,'')}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:CONFIG.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    const body=await response.json().catch(()=>({}));if(!response.ok)return false;session=body;localStorage.setItem(KEYS.session,JSON.stringify(session));return true;
  }
  async function cloudRpc(name,args) { return fetchCloud(`/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',body:JSON.stringify(args)}); }
  async function cloudSelect(table,query='select=*') { return fetchCloud(`/rest/v1/${table}?${query}`); }
  async function cloudSelectAll(table,query='select=*') {const rows=[];const size=500;for(let offset=0;offset<1000000;offset+=size){const page=await fetchCloud(`/rest/v1/${table}?${query}`,{headers:{Range:`${offset}-${offset+size-1}`}});rows.push(...page);if(page.length<size)return rows;}throw new Error('बॅकअपसाठी नोंदींची मर्यादा ओलांडली.');}
  async function cloudInsert(table,rows) { return fetchCloud(`/rest/v1/${table}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(rows)}); }
  async function cloudPatch(table,filter,body) { return fetchCloud(`/rest/v1/${table}?${filter}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)}); }
  const STATUS_DB={pickup_requested:'Pickup Requested',pickup_assigned:'Pickup Assigned',picked_up:'Picked Up',processing:'Processing',washing:'Washing',ironing:'Ironing',quality_check:'Quality Check',ready:'Ready',out_for_delivery:'Out for Delivery',delivered:'Delivered'};
  const STATUS_FROM_DB=Object.fromEntries(Object.entries(STATUS_DB).map(([key,value])=>[value,key]));
  const METHOD_DB={cash:'Cash',upi:'UPI',card:'Card',bank_transfer:'Bank Transfer',other:'Other'};
  const METHOD_FROM_DB=Object.fromEntries(Object.entries(METHOD_DB).map(([key,value])=>[value,key]));
  const EVENT_MR={order_received:'ऑर्डर नोंदवली',payment_confirmation:'पेमेंट मिळाले',pickup_assigned:'पिकअप नियुक्त',picked_up:'कपडे घेतले',processing:'प्रोसेसिंग सुरू',washing_started:'धुलाई सुरू',ironing:'इस्त्री सुरू',quality_check:'गुणवत्ता तपासणी',ready:'ऑर्डर तयार',out_for_delivery:'डिलिव्हरीसाठी बाहेर',delivered:'डिलिव्हरी पूर्ण',outstanding_reminder:'थकबाकी सूचना'};
  const messageStatus={pending:'रांगेत',processing:'पाठवत आहे',sent:'पाठवला',delivered:'पोहोचला',read:'वाचला',failed:'अयशस्वी'};
  function mapCustomer(c){const phone=c.whatsapp_number||c.whatsapp_number_normalized||'',type=({Regular:'नियमित',Subscription:'सब्स्क्रिप्शन',Business:'व्यवसाय'}[c.customer_type]||c.customer_type||'नियमित');return {id:String(c.id),code:c.customer_code||String(c.id).slice(0,8),fullName:c.full_name,whatsapp:phone,whatsappNormalized:c.whatsapp_number_normalized||String(phone).replace(/\D/g,'').slice(-10),altNumber:c.alternate_number||'',address:c.address||'',area:c.area||'',customerType:type,notes:c.notes||'',active:c.is_active!==false,createdAt:c.created_at?.slice(0,10)||today()};}
  function mapService(s){return {id:String(s.id),name:s.service_name,unit:s.unit_type,rate:Number(s.rate),category:'सामान्य',description:'',active:s.active!==false&&!s.is_deleted};}
  function mapOrder(o,items){const placed=String(o.order_date||o.created_at||today()).slice(0,10),paid=Number(o.paid_amount)||0,total=Number(o.total_amount)||0;return {id:String(o.id),number:o.order_number,invoice:o.invoice_number||o.order_number,customerId:String(o.customer_id),placedAt:placed,deliveryAt:String(o.expected_delivery_date||placed).slice(0,10),status:STATUS_FROM_DB[o.status]||o.status,subtotal:Number(o.subtotal)||0,discount:Number(o.discount)||0,total,paid,outstanding:Math.max(0,total-paid),paymentStatus:({Pending:'unpaid',Partial:'partial',Paid:'paid'}[o.payment_status]||'unpaid'),notes:o.notes||'',items:items.filter(i=>String(i.order_id)===String(o.id)).map(i=>({serviceId:String(i.service_id),name:i.item_name||'सेवा',item:i.item_description||'',qty:Number(i.quantity),unit:i.unit,rate:Number(i.rate),amount:Number(i.amount)}))};}
  function mapPayment(p){return {id:String(p.id),orderId:String(p.order_id),amount:Number(p.amount),method:METHOD_FROM_DB[p.payment_method]||'other',receivedAt:p.payment_date,reference:p.reference_number||''};}
  function mapSubscription(s){const plan=PLANS.find(p=>p.dbName===s.plan_name);return {id:String(s.id),customerId:String(s.customer_id),planCode:plan?.code||s.plan_name,startDate:s.start_date,expiryDate:s.expiry_date,limit:Number(s.weekly_limit_kg),period:s.limit_period||'week',usedKg:Number(s.used_kg)||0,monthlyAmount:Number(s.monthly_amount),active:s.active!==false};}
  async function cloudLoad() {
    const [customers,services,orders,items,payments,subscriptions,messages,reminders,settings,rateHistory]=await Promise.all([
      cloudSelectAll('customers','select=*&order=created_at.desc,id.desc'),cloudSelectAll('services','select=*&order=service_name.asc,id.asc'),cloudSelectAll('orders','select=*&order=order_date.desc,id.desc'),cloudSelectAll('order_items','select=*&order=id.asc'),cloudSelectAll('payments','select=*&order=payment_date.desc,id.desc'),cloudSelectAll('subscriptions','select=*&order=expiry_date.asc,id.asc'),cloudSelectAll('whatsapp_messages','select=*&order=created_at.desc,id.desc'),cloudSelectAll('reminders','select=*&order=scheduled_at.desc,id.desc'),cloudSelectAll('business_settings','select=*&order=id.asc'),cloudSelectAll('service_rate_history','select=*&order=changed_at.desc,id.desc')
    ]);
    data={customers:customers.map(mapCustomer),services:services.map(mapService),orders:orders.map(o=>mapOrder(o,items)),payments:payments.map(mapPayment),subscriptions:subscriptions.map(mapSubscription),messages:messages.map(m=>({id:String(m.id),event:EVENT_MR[m.event]||m.event,recipient:m.recipient||'',status:m.status,attempts:m.attempts,createdAt:m.created_at,providerId:m.provider_message_id||'',error:m.last_error||''})),reminders,settings:{businessName:settings[0]?.business_name||'CleanEazy Laundry',location:settings[0]?.address||'पुणे, महाराष्ट्र'},rateHistory};
  }
  function enterApp() {
    $('#login-screen').hidden=true;$('#app-shell').hidden=false;
    $('#user-name').textContent=isDemo?'नमुना व्यवस्थापक':(session?.user?.email||'व्यवस्थापक');$('#user-role').textContent=isDemo?'डेमो वापरकर्ता':'प्रमाणित कर्मचारी';
    $('#connection-title').textContent=isDemo?'नमुना सराव':'Supabase cloud';$('#connection-copy').textContent=isDemo?'स्थानिक डेटा':'सुरक्षित सत्र';$('#demo-banner').hidden=!isDemo||sessionStorage.getItem('cleaneazy.banner.closed')==='1';render();
    if(new URLSearchParams(location.search).get('new')==='1'){history.replaceState({},'',location.pathname);setTimeout(orderForm,50);}
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
  }
  async function liveLogin() {
    const email=$('#login-email').value.trim(),password=$('#login-password').value;if(!hasCloud){showLoginError('Supabase जोडलेले नाही. प्रत्यक्ष लॉगिनसाठी प्रकल्प URL आणि anon key कॉन्फिगर करणे आवश्यक आहे; नमुना सराव सुरू करा.');return;}
    try{await cloudLogin(email,password);isDemo=false;await cloudLoad();enterApp();toast('लॉगिन यशस्वी.');}catch(error){showLoginError(error.message==='Invalid login credentials'?'ई-मेल किंवा पासवर्ड चुकीचा आहे.':`लॉगिन अयशस्वी: ${error.message}`);}
  }
  async function tryRestoreSession() {
    if(!hasCloud)return false;try{session=JSON.parse(localStorage.getItem(KEYS.session)||'null');}catch(_){session=null;}if(!session?.access_token)return false;
    if((session.expires_at||0)*1000<Date.now()+60000){const ok=await refreshCloudSession();if(!ok){localStorage.removeItem(KEYS.session);session=null;return false;}}
    try{isDemo=false;await cloudLoad();enterApp();return true;}catch(error){localStorage.removeItem(KEYS.session);session=null;isDemo=true;toast(`माहिती लोड झाली नाही: ${error.message}`,'error');return false;}
  }
  async function saveCustomer(existingId) {
    const phone=normalizePhone($('#f-phone').value),alt=normalizePhone($('#f-alt').value),customerTypes={'नियमित':'Regular','सब्स्क्रिप्शन':'Subscription','व्यवसाय':'Business'},record={full_name:$('#f-name').value.trim(),whatsapp_number:phone,whatsapp_number_normalized:phone.slice(-10),alternate_number:alt||null,address:$('#f-address').value.trim(),area:$('#f-area').value.trim(),customer_type:customerTypes[$('#f-type').value]||$('#f-type').value,notes:$('#f-notes').value.trim(),is_active:existingId?$('#f-active').checked:true};
    if(!record.full_name||record.whatsapp_number.length!==12||record.whatsapp_number_normalized.length!==10||!record.address){showFormError('कृपया नाव, योग्य भारतीय मोबाइल नंबर आणि पत्ता भरा.');return;}
    if(isDemo){const duplicate=data.customers.find(c=>String(c.id)!==String(existingId)&&c.active&&normalizePhone(c.whatsapp)===record.whatsapp_number);if(duplicate){showFormError('हा WhatsApp नंबर आधीपासून सक्रिय ग्राहकाकडे आहे.');return;}if(existingId){const c=customer(existingId);Object.assign(c,{fullName:record.full_name,whatsapp:record.whatsapp_number,altNumber:record.alternate_number||'',address:record.address,area:record.area,customerType:$('#f-type').value,notes:record.notes,active:record.is_active});}else data.customers.unshift({id:id(),code:`ग्राहक-${String(data.customers.length+1).padStart(3,'0')}`,fullName:record.full_name,whatsapp:record.whatsapp_number,altNumber:record.alternate_number||'',address:record.address,area:record.area,customerType:$('#f-type').value,notes:record.notes,active:true,createdAt:today()});}
    else{try{if(existingId)await cloudPatch('customers',`id=eq.${encodeURIComponent(existingId)}`,record);else await cloudInsert('customers',[record]);await cloudLoad();}catch(error){showFormError(error.code==='23505'||/duplicate|unique|whatsapp/i.test(error.message)?'हा WhatsApp नंबर आधीपासून सक्रिय ग्राहकाकडे आहे.':`ग्राहक जतन झाला नाही: ${error.message}`);return;}}
    persist();closeModal();render();toast(existingId?'ग्राहक माहिती जतन केली.':'ग्राहक यशस्वीरित्या जोडला गेला.');
  }
  async function saveService(existingId) {
    const record={service_name:$('#f-name').value.trim(),rate:Number($('#f-rate').value),unit_type:$('#f-unit').value,active:existingId?$('#f-active').checked:true,is_deleted:false};
    if(!record.service_name||!Number.isFinite(record.rate)||record.rate<=0){showFormError('सेवेचे नाव आणि शून्यापेक्षा जास्त दर भरा.');return;}
    if(isDemo){if(existingId){const s=data.services.find(v=>String(v.id)===String(existingId));if(s.rate!==record.rate)data.rateHistory.unshift({serviceId:s.id,oldRate:s.rate,newRate:record.rate,changedAt:new Date().toISOString()});Object.assign(s,{name:record.service_name,rate:record.rate,unit:record.unit_type,category:'सामान्य',description:'',active:record.active});}else data.services.push({id:id(),name:record.service_name,rate:record.rate,unit:record.unit_type,category:'सामान्य',description:'',active:true});}
    else{try{if(existingId)await cloudPatch('services',`id=eq.${encodeURIComponent(existingId)}`,record);else await cloudInsert('services',[record]);await cloudLoad();}catch(error){showFormError(`सेवा जतन झाली नाही: ${error.message}`);return;}}
    persist();closeModal();render();toast(existingId?'सेवा आणि दर अद्ययावत केले.':'सेवा यशस्वीरित्या जोडली.');
  }
  function orderPayload() {
    const customerId=$('#order-customer').value,delivery=$('#order-delivery').value,placed=today();
    const items=$$('.order-item-row').map(row=>{const s=data.services.find(x=>String(x.id)===$('.item-service',row).value);return {service:s,quantity:Number($('.item-quantity',row).value),item:$('.item-name',row).value.trim()};});
    if(!customerId)return {error:'ग्राहक निवडा.'};if(!placed||!delivery||delivery<placed)return {error:'योग्य ऑर्डर आणि डिलिव्हरी तारीख निवडा.'};if(!items.length||items.some(i=>!i.service||!Number.isFinite(i.quantity)||i.quantity<=0))return {error:'प्रत्येक ऑर्डरसाठी सेवा आणि शून्यापेक्षा जास्त प्रमाण निवडा.'};
    const subtotal=items.reduce((sum,i)=>sum+i.service.rate*i.quantity,0),manualDiscount=Number($('#order-discount').value)||0,welcomeDiscount=welcomeDiscountFor(customerId,subtotal),discount=manualDiscount+welcomeDiscount;if(manualDiscount<0||discount>subtotal)return {error:'एकूण सवलत उपएकूपेक्षा जास्त असू शकत नाही.'};
    return {customerId,delivery,placed,items,subtotal,manualDiscount,welcomeDiscount,discount,total:subtotal-discount,notes:$('#order-notes').value.trim()};
  }
  async function saveOrder() {
    const payload=orderPayload(),button=$('[data-action="save-order"]');if(payload.error){showFormError(payload.error);return;}if(button)button.disabled=true;
    if(isDemo){const seq=Math.max(128,...data.orders.map(o=>Number(String(o.number).match(/(\d+)$/)?.[1]||0)))+1;const lines=payload.items.map(item=>({serviceId:item.service.id,name:item.service.name,item:item.item,qty:item.quantity,unit:item.service.unit,rate:item.service.rate,amount:item.service.rate*item.quantity}));const subtotal=lines.reduce((s,i)=>s+i.amount,0),orderData={id:id(),number:`CE-२०२६-${String(seq).padStart(4,'0')}`,invoice:`INV-२०२६-${String(seq).padStart(4,'0')}`,customerId:payload.customerId,placedAt:payload.placed,deliveryAt:payload.delivery,status:'pickup_requested',subtotal,discount:payload.discount,total:subtotal-payload.discount,paid:0,outstanding:subtotal-payload.discount,paymentStatus:subtotal-payload.discount?'unpaid':'paid',notes:payload.notes,items:lines};data.orders.unshift(orderData);addDemoSubscriptionUsage(payload.customerId,payload.items);makeMessage('ऑर्डर नोंदवली',customer(payload.customerId)?.whatsapp);}
    else{try{await cloudRpc('create_laundry_order',{p_customer_id:Number(payload.customerId),p_expected_delivery_date:payload.delivery,p_discount:payload.manualDiscount,p_paid_amount:0,p_payment_method:'Cash',p_notes:payload.notes,p_idempotency_key:button?.dataset.idempotency||id(),p_items:payload.items.map(i=>({service_id:Number(i.service.id),item_description:i.item,quantity:i.quantity,unit:i.service.unit}))});await cloudLoad();}catch(error){if(button)button.disabled=false;showFormError(`ऑर्डर तयार झाली नाही: ${error.message}`);return;}}
    persist();closeModal();setPage('orders');toast('ऑर्डर यशस्वीरित्या तयार झाली.');
  }
  async function savePayment() {
    const orderId=$('#pay-order').value,amount=Number($('#pay-amount').value),method=$('#pay-method').value,reference=$('#pay-reference').value.trim(),o=order(orderId),button=$('[data-action="save-payment"]');
    if(!o){showFormError('ऑर्डर निवडा.');return;}if(!Number.isFinite(amount)||amount<=0){showFormError('पेमेंट रक्कम शून्यापेक्षा जास्त असावी.');return;}if(amount>o.outstanding+0.00001){showFormError(`पेमेंट थकबाकी ${money(o.outstanding)} पेक्षा जास्त असू शकत नाही.`);return;}
    if(button)button.disabled=true;
    if(isDemo){data.payments.unshift({id:id(),orderId,amount,method,receivedAt:new Date().toISOString(),reference});o.paid+=amount;updateOrderTotals(o);makeMessage('पेमेंट प्राप्त',customer(o.customerId)?.whatsapp);}
    else{try{await cloudRpc('record_laundry_payment',{p_order_id:Number(orderId),p_amount:amount,p_method:METHOD_DB[method],p_reference:reference,p_idempotency_key:button?.dataset.idempotency||id(),p_payment_date:button?.dataset.paymentDate||new Date().toISOString(),p_notes:null});await cloudLoad();}catch(error){if(button)button.disabled=false;showFormError(`पेमेंट नोंदवले नाही: ${error.message}`);return;}}
    persist();closeModal();render();toast('पेमेंट यशस्वीरित्या नोंदवले.');
  }
  async function saveSubscription() {
    const customerId=$('#f-customer').value,plan=PLANS.find(p=>p.code===$('#f-plan').value),start=$('#f-start').value,expiry=$('#f-expiry').value;
    if(!customerId||!plan||!start||!expiry||expiry<start){showFormError('ग्राहक, प्लॅन आणि योग्य मुदतीच्या तारखा निवडा.');return;}
    if(isDemo)data.subscriptions.unshift({id:id(),customerId,planCode:plan.code,startDate:start,expiryDate:expiry,limit:plan.limit,period:plan.period,usedKg:0,monthlyAmount:plan.amount,active:true});
    else{try{await cloudInsert('subscriptions',[{customer_id:Number(customerId),plan_name:plan.dbName,start_date:start,expiry_date:expiry,weekly_limit_kg:plan.limit,limit_period:plan.period,used_kg:0,monthly_amount:plan.amount,active:true}]);await cloudLoad();}catch(error){showFormError(`सब्स्क्रिप्शन जतन झाले नाही: ${error.message}`);return;}}
    persist();closeModal();render();toast('सब्स्क्रिप्शन जोडले.');
  }
  async function advanceOrder(orderId) {
    const o=order(orderId),idx=STATUSES.indexOf(o?.status);if(!o||idx<0)return;if(idx>=STATUSES.length-1){toast('ऑर्डर पूर्ण झाली आहे.','info');return;}const next=STATUSES[idx+1];
    if(isDemo){o.status=next;makeMessage(STATUS[next],customer(o.customerId)?.whatsapp);}else{try{await cloudRpc('change_order_status',{p_order_id:Number(orderId),p_status:STATUS_DB[next]});await cloudLoad();}catch(error){toast(`ऑर्डरची स्थिती बदलली नाही: ${error.message}`,'error');return;}}
    persist();orderDetail(orderId);toast(`ऑर्डरची स्थिती: ${STATUS[next]}.`);
  }
  function printableInvoice(o) {
    const c=customer(o.customerId),popup=window.open('','_blank','width=800,height=900');if(!popup){toast('बिल उघडण्यासाठी ब्राउझरमधील नवीन पानाची परवानगी आवश्यक आहे.','error');return;}
    const rows=(o.items||[]).map(i=>`<tr><td>${esc(i.name)}${i.item?`<small>${esc(i.item)}</small>`:''}</td><td>${num(i.qty)} ${i.unit==='kg'?'किलो':'वस्तू'}</td><td>${money(i.rate)}</td><td>${money(i.amount)}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html lang="mr-IN"><head><meta charset="utf-8"><title>${esc(o.invoice)} · CleanEazy</title><style>body{font:14px 'Nirmala UI',Mangal,sans-serif;color:#183f37;margin:40px;line-height:1.6}.head{display:flex;justify-content:space-between;border-bottom:1px solid #ccd5cc;padding-bottom:16px}h1{font-size:23px;margin:0}p{margin:2px 0;color:#64746b;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:25px}th,td{padding:11px;border-bottom:1px solid #e5e9e3;text-align:left;font-size:12px}th{background:#f6f8f4}td small{display:block;color:#7b887f}.totals{margin:22px 0 0 auto;width:250px}.totals div{display:flex;justify-content:space-between;padding:4px}.total{border-top:1px solid #bfc9c0;font-weight:bold;padding-top:10px!important}@media print{button{display:none}}</style></head><body><div class="head"><div><h1>CleanEazy Laundry</h1><p>स्वच्छ कपडे. शून्य त्रास.</p><p>पुणे, महाराष्ट्र</p></div><div style="text-align:right"><strong>बिल</strong><p>बिल क्रमांक: ${esc(o.invoice)}</p><p>ऑर्डर: ${esc(o.number)}</p><p>ऑर्डर तारीख: ${dateFmt(o.placedAt)}</p><p>डिलिव्हरी तारीख: ${dateFmt(o.deliveryAt)}</p></div></div><p style="margin-top:20px">ग्राहक: <strong>${esc(c?.fullName||'')}</strong> · ${displayPhone(c?.whatsapp)}</p><p>${esc(c?.address||'')}</p><table><thead><tr><th>सेवा / वस्तू</th><th>प्रमाण</th><th>दर</th><th>रक्कम</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>उपएकूण</span><strong>${money(o.subtotal)}</strong></div><div><span>सवलत</span><strong>− ${money(o.discount)}</strong></div><div class="total"><span>एकूण</span><strong>${money(o.total)}</strong></div><div><span>भरलेली रक्कम</span><strong>${money(o.paid)}</strong></div><div><span>थकबाकी</span><strong>${money(o.outstanding)}</strong></div><div><span>पेमेंट स्थिती</span><strong>${PAYMENT_STATE[o.paymentStatus]}</strong></div></div><p style="margin-top:50px">CleanEazy Laundry च्या सेवेबद्दल धन्यवाद.</p><button onclick="window.print()">प्रिंट / PDF म्हणून जतन करा</button></body></html>`);popup.document.close();
  }
  function download(name,content,type='application/json') {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function exportBackup() {
    let snapshot;
    if(isDemo){snapshot={format:'cleaneazy-demo-backup-v1',created_at:new Date().toISOString(),data:structuredClone(data)};}
    else{try{const tables=['customers','services','orders','order_items','payments','subscriptions','reminders','whatsapp_messages','service_rate_history','business_settings'],rows=await Promise.all(tables.map(table=>cloudSelectAll(table,'select=*&order=id.asc')));snapshot={format:'cleaneazy-backup',version:1,created_at:new Date().toISOString(),data:Object.fromEntries(tables.map((table,index)=>[table,rows[index]]))};}catch(error){toast(`बॅकअप तयार झाला नाही: ${error.message}`,'error');return;}}
    download(`CleanEazy-बॅकअप-${today()}.json`,JSON.stringify(snapshot,null,2));localStorage.setItem('cleaneazy.last.backup',today());toast('बॅकअप डाउनलोडसाठी तयार आहे.');
  }
  async function restoreBackup(file) {
    try{const snapshot=JSON.parse(await file.text());
      if(isDemo){const d=snapshot?.data,required=['customers','services','orders','payments','subscriptions','messages','rateHistory'];if(snapshot?.format!=='cleaneazy-demo-backup-v1'||!d||required.some(key=>!Array.isArray(d[key]))||!d.settings||typeof d.settings!=='object')throw new Error('ही नमुना सरावासाठीची संपूर्ण बॅकअप फाइल नाही.');if(!window.confirm('या ब्राउझरमधील नमुना डेटा निवडलेल्या बॅकअपने बदलेल. पुढे जायचे?'))return;data={customers:d.customers,services:d.services,orders:d.orders,payments:d.payments,subscriptions:d.subscriptions,messages:d.messages,settings:d.settings,rateHistory:d.rateHistory};persist();render();toast('नमुना बॅकअपमधून डेटा परत आणला.');}
      else{const tables=['customers','services','orders','order_items','payments','subscriptions','reminders','whatsapp_messages','service_rate_history','business_settings'],d=snapshot?.data;if(snapshot?.format!=='cleaneazy-backup'||snapshot?.version!==1||!d||tables.some(key=>!Array.isArray(d[key])))throw new Error('ही ऑनलाइन डेटासाठीची संपूर्ण CleanEazy बॅकअप फाइल नाही.');if(!window.confirm('ऑनलाइन साठ्यातील सध्याचा व्यवसाय डेटा या बॅकअपने बदलेल. ही कृती पूर्ववत करता येणार नाही. पुढे जायचे?'))return;try{await cloudRpc('restore_cleaneazy_backup',{p_backup:snapshot});await cloudLoad();render();toast('ऑनलाइन बॅकअपमधून डेटा परत आणला.');}catch(error){toast(`डेटा restore झाला नाही: ${error.message}`,'error');}}
    }catch(error){toast(`बॅकअप फाइल वाचली नाही: ${error.message}`,'error');}finally{$('#backup-file').value='';}
  }
  function exportReport() {
    const rows=[['ऑर्डर क्रमांक','ग्राहक','ऑर्डर तारीख','स्थिती','एकूण','भरलेले','थकबाकी'],...data.orders.map(o=>[o.number,customer(o.customerId)?.fullName||'',o.placedAt,STATUS[o.status],o.total,o.paid,o.outstanding])];
    const csv='\uFEFF'+rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');download(`CleanEazy-अहवाल-${today()}.csv`,csv,'text/csv;charset=utf-8');
  }
  async function logout() {
    if(!isDemo&&session?.access_token){try{await fetch(`${String(CONFIG.supabaseUrl).replace(/\/$/,'')}/auth/v1/logout`,{method:'POST',headers:{apikey:CONFIG.supabaseAnonKey,Authorization:`Bearer ${session.access_token}`}});}catch(_){}}
    session=null;localStorage.removeItem(KEYS.session);data=null;isDemo=true;$('#app-shell').hidden=true;$('#login-screen').hidden=false;$('#login-password').value='';$('#login-error')?.remove();setPage('dashboard');
  }
  page.addEventListener('click',async event=>{
    const action=event.target.closest('[data-action]');if(!action)return;const kind=action.dataset.action,idValue=action.dataset.id;
    if(kind==='new-order')orderForm();else if(kind==='new-customer')customerForm();else if(kind==='new-service')serviceForm();else if(kind==='new-payment')paymentForm();else if(kind==='add-order-payment')paymentForm(idValue);else if(kind==='new-subscription')subscriptionForm();
    else if(kind==='order-detail')orderDetail(idValue);else if(kind==='customer-detail')customerDetail(idValue);else if(kind==='edit-customer')customerForm(customer(idValue));else if(kind==='edit-service')serviceForm(data.services.find(s=>s.id===idValue));
    else if(kind==='advance-order')await advanceOrder(idValue);else if(kind==='invoice')printableInvoice(order(idValue));
    else if(kind==='go-page'){event.preventDefault();setPage(action.dataset.page);}else if(kind==='backup-export')await exportBackup();else if(kind==='export-report')exportReport();else if(kind==='refresh'){if(!isDemo){try{await cloudLoad();render();toast('माहिती अद्ययावत केली.');}catch(error){toast(`माहिती अद्ययावत झाली नाही: ${error.message}`,'error');}}else render();}
  });
  $('#app-modal').addEventListener('click',async event=>{
    if(event.target===modal){closeModal();return;}const action=event.target.closest('[data-action]');if(!action)return;const kind=action.dataset.action,idValue=action.dataset.id;
    if(kind==='close-modal')closeModal();else if(kind==='save-customer')await saveCustomer(idValue||null);else if(kind==='save-service')await saveService(idValue||null);else if(kind==='save-order')await saveOrder();else if(kind==='save-payment')await savePayment();else if(kind==='save-subscription')await saveSubscription();else if(kind==='advance-order')await advanceOrder(idValue);else if(kind==='invoice')printableInvoice(order(idValue));else if(kind==='add-order-payment')paymentForm(idValue);else if(kind==='edit-customer')customerForm(customer(idValue));else if(kind==='add-item'){addOrderItemRow();localOrderTotal();}else if(kind==='remove-item'){const rows=$$('.order-item-row');if(rows.length>1)action.closest('.order-item-row').remove();localOrderTotal();}
  });
  $('#side-brand')?.addEventListener('click',()=>setPage('dashboard'));
  $$('.side-nav [data-page]').forEach(button=>button.addEventListener('click',()=>setPage(button.dataset.page)));
  $('#login-form').addEventListener('submit',event=>{event.preventDefault();liveLogin();});
  $('#demo-login').addEventListener('click',()=>{isDemo=true;data=loadDemo();enterApp();toast('नमुना सराव सुरू झाला.','info');});
  $('#logout-button').addEventListener('click',logout);
  $('#demo-banner-close').addEventListener('click',()=>{$('#demo-banner').hidden=true;sessionStorage.setItem('cleaneazy.banner.closed','1');});
  $('#mobile-menu').addEventListener('click',()=>{$('#sidebar').classList.toggle('open');$('#mobile-overlay').classList.toggle('open');});
  $('#mobile-overlay').addEventListener('click',()=>{$('#sidebar').classList.remove('open');$('#mobile-overlay').classList.remove('open');});
  $('#global-search').addEventListener('keydown',event=>{if(event.key==='Enter'){const q=event.currentTarget.value;setPage('orders');renderOrders(q);}});
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#global-search').focus();}});
  page.addEventListener('input',event=>{if(event.target.id==='customer-search'){const value=event.target.value;renderCustomers(value);const input=$('#customer-search');input?.focus();input?.setSelectionRange(value.length,value.length);}if(event.target.id==='order-search'){const value=event.target.value;renderOrders(value);const input=$('#order-search');input?.focus();input?.setSelectionRange(value.length,value.length);}});
  page.addEventListener('change',event=>{if(event.target.id==='order-filter'){const current=$('#order-search')?.value||'';const selected=event.target.value;renderOrders(current);const filter=$('#order-filter');if(filter)filter.value=selected;const rows=$$('.orders-table tbody tr');rows.forEach(row=>{const pill=$('.status-pill',row);if(selected&&pill?.classList.contains(`status-${selected}`)===false)row.hidden=true;});}});
  modal.addEventListener('change',event=>{if(event.target.id==='order-customer')updateOrderSubscriptions(event.target.value);if(event.target.id==='pay-order')updatePaymentMax();if(event.target.id==='order-subscription')localOrderTotal();if(event.target.matches('.item-service,.item-quantity')||event.target.id==='order-discount')localOrderTotal();});
  modal.addEventListener('input',event=>{if(event.target.matches('.item-quantity')||event.target.id==='order-discount')localOrderTotal();});
  $('#backup-file').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)restoreBackup(file);});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;$('#install-button').hidden=false;});
  $('#install-button').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#install-button').hidden=true;});
  (async()=>{if(await tryRestoreSession())return;})();
})();
