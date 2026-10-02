(function () {
  'use strict';
  var STATUS = ['Pickup Requested','Pickup Assigned','Picked Up','Processing','Washing','Ironing','Quality Check','Ready','Out for Delivery','Delivered'];
  var PLANS = [
    {name:'Student/Bachelor Basic',registration:1000,monthly:599,kg:5,weekly:true},
    {name:'Student/Bachelor Premium',registration:1499,monthly:1199,kg:10,weekly:true},
    {name:'Dosti Yari',registration:3000,monthly:1999,kg:50,weekly:false},
    {name:'Basic Family',registration:1500,monthly:799,kg:7,weekly:true},
    {name:'Family Economy',registration:2100,monthly:1199,kg:10,weekly:true}
  ];
  var TABLES = ['customers','services','orders','order_items','payments','subscriptions','reminders','whatsapp_messages','service_rate_history','business_settings'];
  var PAGE_SIZE = 25;
  var client = null;
  var user = null;
  var staff = null;
  var currentView = 'dashboard';
  var pages = {orders:0,customers:0,payments:0};
  var lastOrders = [];
  var lastCustomers = [];
  var lastSubscriptions = [];
  var lastServices = [];
  var lastSettings = null;
  var toastTimer = null;

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
  function money(value) { return '₹' + Number(value || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function compactMoney(value) { return '₹' + Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:0}); }
  function indiaDate(date) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date || new Date()); }
  function displayDate(value, options) { if (!value) return '—'; var d = new Date(value); if (Number.isNaN(d.getTime())) return esc(value); return new Intl.DateTimeFormat('en-IN',options || {day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(d); }
  function displayDateTime(value) { return value ? new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}).format(new Date(value)) : '—'; }
  function timeBounds(date) { return {from:date+'T00:00:00+05:30',to:date+'T23:59:59.999+05:30'}; }
  function normalizePhone(value) { var d = String(value || '').replace(/\D/g,''); if (d.indexOf('0091') === 0) d = d.slice(4); if (d.indexOf('91') === 0 && d.length === 12) d = d.slice(2); if (d.indexOf('0') === 0 && d.length === 11) d = d.slice(1); if (d.length > 10) d = d.slice(-10); return d; }
  function statusClass(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function paymentClass(value) { return String(value || 'Pending').toLowerCase(); }
  function setBusy(button, busy, label) { if (!button) return; button.disabled = !!busy; if (busy) { button.dataset.oldText = button.innerHTML; button.innerHTML = '<span class="spinner"></span> ' + esc(label || 'Working…'); } else if (button.dataset.oldText) { button.innerHTML = button.dataset.oldText; delete button.dataset.oldText; } }
  function toast(message, type) { var region=$('#toast-region'); if(!region)return; var node=document.createElement('div'); node.className='toast '+(type||''); node.textContent=message; region.appendChild(node); window.setTimeout(function(){if(node.parentNode)node.parentNode.removeChild(node);},4700); }
  function fail(error, context) { var message=error && error.message ? error.message : String(error || 'Unknown error'); console.error(context || 'CleanEazy application error:', error); toast((context ? context + ': ' : '') + message,'error'); }
  function empty(title, detail) { return '<div class="empty-state"><strong>'+esc(title)+'</strong>'+esc(detail || '')+'</div>'; }
  function pill(status, payment) { return '<span class="'+(payment?'payment-pill ':'status-pill ')+(payment?paymentClass(status):statusClass(status))+'">'+esc(status || 'Pending')+'</span>'; }
  function initials(name) { var p=String(name||'C').trim().split(/\s+/); return ((p[0]||'C').charAt(0)+(p.length>1?p[p.length-1].charAt(0):'')).toUpperCase(); }
  function currentDisplayName() { return (staff && staff.display_name) || (user && user.email ? user.email.split('@')[0] : 'CleanEazy team'); }
  function showOnly(id) { ['auth-shell','blocked-shell','app-frame'].forEach(function (name) { var node=document.getElementById(name); node.hidden=name!==id; }); }
  function setAuthMessage(message) { var node=$('#login-error'); if(node)node.textContent=message||''; }
  function loadFailNotice(message) { setAuthMessage(message); showOnly('auth-shell'); }
  function openDialog(title, body, actions) {
    var dialog=$('#app-dialog'); var inner=$('#dialog-inner');
    inner.innerHTML='<div class="dialog-head"><h2>'+esc(title)+'</h2><button type="button" class="dialog-close" data-close aria-label="Close">×</button></div><div class="dialog-body">'+body+'</div>'+(actions || '');
    if (!dialog.open) dialog.showModal();
    var focus=$('input,select,textarea,button',inner); if(focus)window.setTimeout(function(){focus.focus();},30);
  }
  function closeDialog() { var d=$('#app-dialog'); if(d && d.open)d.close(); }
  function safeError(error, form) { var node=form && $('.form-error',form); if(node)node.textContent=error && error.message ? error.message : String(error || 'Something went wrong.'); else fail(error); }

  function start() {
    if (!window.CLEANEAZY_SUPABASE || !window.supabase || !window.supabase.createClient) {
      loadFailNotice('The secure sign-in library could not load. Check your internet connection and reload this page.'); return;
    }
    client=window.supabase.createClient(window.CLEANEAZY_SUPABASE.url,window.CLEANEAZY_SUPABASE.publishableKey);
    bindStaticEvents();
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT') { user=null; staff=null; showOnly('auth-shell'); setAuthMessage(''); return; }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        window.setTimeout(function(){if(session)activateSession(session);else {user=null;staff=null;showOnly('auth-shell');}},0);
      }
    });
    client.auth.getSession().then(function (response) {
      if(response.error){loadFailNotice('We could not read your saved sign-in. Please sign in again.');return;}
      if(response.data && response.data.session)activateSession(response.data.session);else showOnly('auth-shell');
    }).catch(function(error){loadFailNotice('We could not connect to your business sign-in. '+(error.message||''));});
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(function(error){console.warn('Offline app install is unavailable:',error.message);});
  }

  async function activateSession(session) {
    if (!client || !session || !session.user) return;
    user=session.user;
    showOnly('blocked-shell');
    $('#blocked-message').textContent='Checking your CleanEazy team access…';
    try {
      var response=await client.from('staff_users').select('user_id,display_name,role,active').eq('user_id',user.id).maybeSingle();
      if (response.error) throw response.error;
      staff=response.data;
      if (!staff || !staff.active) { $('#blocked-message').textContent='You’re signed in, but this account is not active on the CleanEazy team. Ask an administrator to invite or reactivate it.';return; }
      $('#profile-name').textContent=currentDisplayName(); $('#profile-role').textContent=staff.role; $('#profile-avatar').textContent=initials(currentDisplayName()); $('#greeting-name').textContent=(currentDisplayName().split(/\s+/)[0]||'team');
      $$('.admin-only').forEach(function(node){node.hidden=staff.role!=='admin';});
      showOnly('app-frame');
      await loadDashboard();
      await updatePendingBadge();
    } catch(error) { staff=null; $('#blocked-message').textContent='Your business access could not be verified. Please ask the CleanEazy administrator to check your team account.'; console.error('Access check failed:',error); }
  }

  function bindStaticEvents() {
    $('#login-form').addEventListener('submit',login);
    $('#toggle-password').addEventListener('click',function(){var input=$('#login-password');var reveal=input.type==='password';input.type=reveal?'text':'password';this.textContent=reveal?'Hide':'Show';this.setAttribute('aria-label',reveal?'Hide password':'Show password');});
    $('#forgot-password').addEventListener('click',forgotPassword);
    $('#blocked-logout').addEventListener('click',logout);
    $('#logout-button').addEventListener('click',logout);
    $('#mobile-nav-toggle').addEventListener('click',function(){var aside=$('#sidebar');var open=!aside.classList.contains('is-open');aside.classList.toggle('is-open',open);this.setAttribute('aria-expanded',String(open));});
    $$('.nav-item').forEach(function(item){item.addEventListener('click',function(){goView(item.dataset.view);$('#sidebar').classList.remove('is-open');$('#mobile-nav-toggle').setAttribute('aria-expanded','false');});});
    $('#view-container').addEventListener('click',delegatedClick);
    $('#view-container').addEventListener('change',function(event){var role=event.target.closest('select[data-team-update="role"]');if(role)updateTeamMember(role.dataset.userId,'role').catch(function(error){fail(error,'Team access could not be updated');});});
    $('#dialog-inner').addEventListener('click',dialogClick);
    $('#dialog-inner').addEventListener('input',dialogInput);
    $('#dialog-inner').addEventListener('change',dialogInput);
    $('#dialog-inner').addEventListener('submit',dialogSubmit);
    $('#app-dialog').addEventListener('click',function(event){if(event.target===this)closeDialog();});
    $$('.refresh-button').forEach(function(button){button.addEventListener('click',function(){loadView(currentView);});});
    $('#orders-search').addEventListener('input',debounce(function(){pages.orders=0;loadOrders();},220));
    $('#order-status-filter').addEventListener('change',function(){pages.orders=0;loadOrders();});
    $('#customers-search').addEventListener('input',debounce(function(){pages.customers=0;loadCustomers();},220));
    $('#customer-status-filter').addEventListener('change',function(){pages.customers=0;loadCustomers();});
    $('#payments-search').addEventListener('input',debounce(function(){pages.payments=0;loadPayments();},220));
    $('#payment-date-filter').addEventListener('change',function(){pages.payments=0;loadPayments();});
    $('#subscriptions-search').addEventListener('input',debounce(loadSubscriptions,220));
    $('#subscription-status-filter').addEventListener('change',loadSubscriptions);
    $('#message-status-filter').addEventListener('change',loadMessages);
    $('#reminder-status-filter').addEventListener('change',loadReminders);
    $('#report-month').value=indiaDate(new Date()).slice(0,7);
    $('#report-month').addEventListener('change',loadReports);
    $('#process-messages').addEventListener('click',processMessages);
    $('#create-backup').addEventListener('click',createBackup);
    $('#restore-file').addEventListener('change',restoreBackup);
    $('#export-outstanding').addEventListener('click',exportOutstanding);
    $('#invite-form').addEventListener('submit',inviteStaff);
    $('#save-settings').addEventListener('click',saveSettings);
    document.addEventListener('keydown',function(event){if(event.key==='Escape')$('#sidebar').classList.remove('is-open');});
  }

  async function login(event) {
    event.preventDefault(); setAuthMessage('');
    var button=$('#login-submit');setBusy(button,true,'Signing in…');
    try {
      var result=await client.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
      if(result.error)throw result.error;
      $('#login-password').value='';
      await activateSession(result.data.session);
    } catch(error) { setAuthMessage(error.message || 'We could not sign you in. Check your email and password.'); }
    finally { setBusy(button,false); }
  }
  async function forgotPassword() {
    var email=$('#login-email').value.trim(); if(!email){setAuthMessage('Enter your email address first, then choose Forgot password.');$('#login-email').focus();return;}
    try { var result=await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});if(result.error)throw result.error;setAuthMessage('If this team account exists, password reset instructions will arrive by email.'); }
    catch(error){setAuthMessage(error.message||'Password reset could not be requested right now.');}
  }
  async function logout() { if(client)await client.auth.signOut(); user=null;staff=null;showOnly('auth-shell'); }
  function debounce(fn,wait){var timer;return function(){var args=arguments,context=this;window.clearTimeout(timer);timer=window.setTimeout(function(){fn.apply(context,args);},wait);};}
  function goView(name) {
    if(!name || (['team','settings','reminders'].indexOf(name)>=0 && (!staff || staff.role!=='admin')))return;
    currentView=name; $$('.view').forEach(function(view){view.classList.toggle('is-current',view.id==='view-'+name);}); $$('.nav-item').forEach(function(item){item.classList.toggle('is-active',item.dataset.view===name);});
    var node=$('#view-'+name);$('#breadcrumb-current').textContent=node?node.dataset.title:name;
    loadView(name);
  }
  function loadView(name) {
    var actions={dashboard:loadDashboard,orders:loadOrders,customers:loadCustomers,services:loadServicesPage,payments:loadPayments,subscriptions:loadSubscriptions,reminders:loadReminders,reports:loadReports,messages:loadMessages,backups:loadBackupHistory,team:loadTeam,settings:loadSettings};
    if(actions[name])actions[name]().catch(function(error){fail(error,'Could not load '+name);});
  }
  function delegatedClick(event) {
    var action=event.target.closest('[data-action]'); if(action){var kind=action.dataset.action;if(kind==='new-order')newOrder(Number(action.dataset.customerId)||undefined);if(kind==='new-customer')editCustomer();if(kind==='new-service')editService();if(kind==='new-subscription')newSubscription();if(kind==='new-reminder')newReminder();return;}
    var go=event.target.closest('[data-go]');if(go){goView(go.dataset.go);return;}
    var detail=event.target.closest('[data-order-detail]');if(detail){showOrder(Number(detail.dataset.orderDetail));return;}
    var customer=event.target.closest('[data-customer-detail]');if(customer){showCustomer(Number(customer.dataset.customerDetail));return;}
    var svc=event.target.closest('[data-edit-service]');if(svc){var item=lastServices.find(function(x){return x.id===Number(svc.dataset.editService);});if(item)editService(item);return;}
    var sub=event.target.closest('[data-toggle-subscription]');if(sub){toggleSubscription(Number(sub.dataset.toggleSubscription));return;}
    var member=event.target.closest('[data-team-update]');if(member){if(member.dataset.teamUpdate==='active')updateTeamMember(member.dataset.userId,'active');return;}
    var retry=event.target.closest('[data-retry-message]');if(retry){retryMessage(Number(retry.dataset.retryMessage));return;}
    var cancel=event.target.closest('[data-cancel-reminder]');if(cancel){cancelReminder(Number(cancel.dataset.cancelReminder));return;}
    var page=event.target.closest('[data-page]');if(page){pages[page.dataset.pageTable]=Number(page.dataset.page);loadView(page.dataset.pageTable);return;}
    var history=event.target.closest('[data-payment-order]');if(history){showOrder(Number(history.dataset.paymentOrder));return;}
  }
  function dialogClick(event) {
    if(event.target.closest('[data-close]')){closeDialog();return;}
    if(event.target.closest('[data-add-line]')){addOrderLine();return;}
    var remove=event.target.closest('[data-remove-line]');if(remove){remove.closest('.line-item').remove();updateOrderPreview();return;}
    var advance=event.target.closest('[data-advance-order]');if(advance){advanceOrder(Number(advance.dataset.id),advance.dataset.next);return;}
    var pay=event.target.closest('[data-take-payment]');if(pay){paymentForm(Number(pay.dataset.takePayment));return;}
    var print=event.target.closest('[data-print-invoice]');if(print){if(print.dataset.printInvoice)loadInvoice(Number(print.dataset.printInvoice)).catch(function(error){fail(error,'Invoice could not be opened');});else window.print();return;}
    var cust=event.target.closest('[data-customer-edit]');if(cust){var c=lastCustomers.find(function(x){return x.id===Number(cust.dataset.customerEdit);});if(c)editCustomer(c);return;}
    var inactivate=event.target.closest('[data-customer-toggle]');if(inactivate){toggleCustomer(Number(inactivate.dataset.customerToggle));return;}
    var showOrderButton=event.target.closest('[data-open-order]');if(showOrderButton){showOrder(Number(showOrderButton.dataset.openOrder));return;}
    var profileOrder=event.target.closest('[data-action="new-order"][data-customer-id]');if(profileOrder){newOrder(Number(profileOrder.dataset.customerId));return;}
  }
  function dialogInput(event) { if(event.target.closest('.line-item') || event.target.id==='order-discount')updateOrderPreview(); }
  function dialogSubmit(event) {
    var form=event.target;if(form.id==='customer-form'){event.preventDefault();saveCustomer(form);}else if(form.id==='service-form'){event.preventDefault();saveService(form);}else if(form.id==='order-form'){event.preventDefault();saveOrder(form);}else if(form.id==='payment-form'){event.preventDefault();savePayment(form);}else if(form.id==='subscription-form'){event.preventDefault();saveSubscription(form);}else if(form.id==='reminder-form'){event.preventDefault();saveReminder(form);}
  }

  function metric(label,value,icon,foot,style){return '<article class="metric-card '+(style||'')+'"><div class="metric-top"><span class="metric-label">'+esc(label)+'</span><span class="metric-icon">'+icon+'</span></div><div class="metric-value">'+esc(value)+'</div><div class="metric-foot">'+esc(foot||'')+'</div></article>';}
  async function countQuery(table,filter){var query=client.from(table).select('*',{count:'exact',head:true});if(filter)query=filter(query);var r=await query;if(r.error)throw r.error;return r.count||0;}
  async function loadDashboard() {
    $('#dashboard-metrics').innerHTML='<div class="loading-state">Loading your business figures…</div>';
    var day=indiaDate(new Date()),bounds=timeBounds(day),weekStart=new Date(Date.now()-6*86400000);var from=indiaDate(weekStart)+'T00:00:00+05:30';
    var result=await Promise.all([
      client.from('orders').select('id,order_number,customer_id,order_date,status,total_amount,paid_amount,payment_status,customer:customers(full_name)').order('order_date',{ascending:false}).limit(1000),
      client.from('payments').select('id,amount,payment_date').gte('payment_date',from).lte('payment_date',bounds.to).order('payment_date',{ascending:false}).limit(1000),
      client.from('order_items').select('amount,service:services(service_name)').limit(2000),
      countQuery('customers',function(q){return q.eq('is_active',true);}),
      countQuery('subscriptions',function(q){return q.eq('active',true).gte('expiry_date',day);})
    ]);
    result.slice(0,3).forEach(function(r){if(r.error)throw r.error;});
    var orders=result[0].data||[],payments=result[1].data||[],items=result[2].data||[];lastOrders=orders;
    var todayOrders=orders.filter(function(o){return String(o.order_date).slice(0,10)===day;});
    var pending=orders.filter(function(o){return o.status!=='Delivered';});
    var processing=orders.filter(function(o){return ['Processing','Washing','Ironing','Quality Check'].indexOf(o.status)>=0;});
    var ready=orders.filter(function(o){return o.status==='Ready';});
    var out=orders.filter(function(o){return o.status==='Out for Delivery';});
    var deliveredToday=orders.filter(function(o){return o.status==='Delivered'&&o.delivered_at&&String(o.delivered_at).slice(0,10)===day;});
    var todaySales=todayOrders.reduce(function(sum,o){return sum+Number(o.total_amount||0);},0);
    var todayCollection=payments.filter(function(p){return String(p.payment_date).slice(0,10)===day;}).reduce(function(sum,p){return sum+Number(p.amount||0);},0);
    var outstanding=orders.reduce(function(sum,o){return sum+Math.max(Number(o.total_amount||0)-Number(o.paid_amount||0),0);},0);
    $('#dashboard-metrics').innerHTML=metric('TODAY’S ORDERS',todayOrders.length,'▤','Orders created today')+metric('PENDING ORDERS',pending.length,'◷','Not yet delivered','metric-warm')+metric('PROCESSING',processing.length,'✳','Washing through quality check')+metric('READY',ready.length,'✓','Ready to go','')+metric('OUT FOR DELIVERY',out.length,'↗','With a delivery runner')+metric('DELIVERED TODAY',deliveredToday.length,'⌂','Completed today')+metric('TODAY’S SALES',compactMoney(todaySales),'₹','Order totals created today','metric-warm')+metric('TODAY’S COLLECTION',compactMoney(todayCollection),'↙','Payments collected today')+metric('OUTSTANDING',compactMoney(outstanding),'!','Open customer balances','metric-alert')+metric('ACTIVE SUBSCRIPTIONS',result[4],'◉','Current plans');
    drawChart($('#dashboard-chart'),orders,payments,7);
    $('#status-summary').innerHTML=STATUS.map(function(status){var n=orders.filter(function(o){return o.status===status;}).length;return '<div class="status-row"><i class="status-dot"></i><span>'+esc(status)+'</span><b>'+n+'</b></div>';}).join('');
    $('#recent-orders').innerHTML=orders.slice(0,6).map(function(o){return '<button class="mini-order" data-order-detail="'+o.id+'"><span><b>'+esc(o.order_number)+'</b><small>'+esc((o.customer&&o.customer.full_name)||'Customer')+' · '+esc(displayDate(o.order_date))+'</small></span><span class="money">'+money(o.total_amount)+'</span></button>';}).join('')||empty('No orders yet','Your first order will show up here.');
    $('#service-mix').innerHTML=serviceMix(items);
    var count=orders.filter(function(o){return STATUS.indexOf(o.status)>=0&&STATUS.indexOf(o.status)<7;}).length;$('#nav-pending-count').textContent=count?String(count):'';
  }
  async function updatePendingBadge(){try{var q=await client.from('orders').select('status').neq('status','Delivered').limit(1000);if(!q.error){var n=(q.data||[]).length;$('#nav-pending-count').textContent=n?String(n):'';}}catch(error){console.warn('Order badge could not refresh',error);}}
  function drawChart(node,orders,payments,days,monthStart) {
    if(!node)return;var labels=[],sales=[],collections=[],today=new Date();
    for(var i=days-1;i>=0;i--){var d=new Date(today);d.setDate(d.getDate()-i);var key=indiaDate(d);labels.push(key);sales.push(0);collections.push(0);}
    var index={};labels.forEach(function(k,i){index[k]=i;});
    (orders||[]).forEach(function(o){var k=String(o.order_date||'').slice(0,10);if(index[k]!=null)sales[index[k]]+=Number(o.total_amount||0);});
    (payments||[]).forEach(function(p){var k=String(p.payment_date||'').slice(0,10);if(index[k]!=null)collections[index[k]]+=Number(p.amount||0);});
    var max=Math.max.apply(null,sales.concat(collections).concat([1]));
    node.innerHTML=labels.map(function(k,i){var h1=Math.max(sales[i]?5:0,sales[i]/max*100);var h2=Math.max(collections[i]?5:0,collections[i]/max*100);var short=displayDate(k,{day:'numeric',month:'short',timeZone:'Asia/Kolkata'});return '<div class="bar-group" title="'+esc(short)+': sales '+money(sales[i])+', collection '+money(collections[i])+'"><div class="bars"><i class="bar" style="height:'+h1+'%"></i><i class="bar collection" style="height:'+h2+'%"></i></div><span class="bar-label">'+esc(short)+'</span></div>';}).join('');
  }
  function serviceMix(items) {
    var totals={};(items||[]).forEach(function(item){var name=item.service&&item.service.service_name||'Other';totals[name]=(totals[name]||0)+Number(item.amount||0);});var keys=Object.keys(totals).sort(function(a,b){return totals[b]-totals[a];}).slice(0,6),max=Math.max.apply(null,keys.map(function(k){return totals[k];}).concat([1]));
    if(!keys.length)return empty('No service sales yet','Service totals appear after orders are created.');
    return keys.map(function(k){return '<div class="mix-row"><span>'+esc(k)+'</span><div class="mix-track"><div class="mix-fill" style="width:'+Math.max(3,totals[k]/max*100)+'%"></div></div><span class="mix-value">'+compactMoney(totals[k])+'</span></div>';}).join('');
  }

  async function loadOrders() {
    var host=$('#orders-list');host.innerHTML='<div class="loading-state">Loading orders…</div>';
    var from=pages.orders*PAGE_SIZE,to=from+PAGE_SIZE-1;var query=client.from('orders').select('id,order_number,invoice_number,customer_id,order_date,expected_delivery_date,status,total_amount,paid_amount,payment_status,customer:customers(id,full_name,whatsapp_number)',{count:'exact'}).order('order_date',{ascending:false}).range(from,to);
    var status=$('#order-status-filter').value;if(status)query=query.eq('status',status);var search=$('#orders-search').value.trim().replace(/[(),%]/g,'');if(search)query=query.or('order_number.ilike.%'+search+'%,invoice_number.ilike.%'+search+'%');
    var r=await query;if(r.error)throw r.error;lastOrders=r.data||[];var rows=lastOrders.map(orderRow).join('');host.innerHTML=rows?dataHeader(['ORDER / CUSTOMER','ORDER DATE','STATUS','TOTAL / DUE',''] ,rows):empty('No matching orders','Try another search or create a new order.');renderPagination('orders-pagination',r.count||0,'orders');
  }
  function dataHeader(labels,rows) { return '<div class="data-head">'+labels.map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+'</div>'+rows; }
  function orderRow(o) { var due=Math.max(Number(o.total_amount||0)-Number(o.paid_amount||0),0);return '<div class="data-row"><span class="primary-cell"><button class="quiet-link" data-order-detail="'+o.id+'">'+esc(o.order_number)+'</button><small class="secondary-cell">'+esc(o.customer&&o.customer.full_name||'Customer')+' · '+esc(o.customer&&o.customer.whatsapp_number||'')+'</small></span><span>'+esc(displayDate(o.order_date))+'<small class="secondary-cell">Due '+esc(displayDate(o.expected_delivery_date))+'</small></span><span>'+pill(o.status,false)+'</span><span>'+money(o.total_amount)+'<small class="secondary-cell">Due '+money(due)+'</small></span><span class="row-actions"><button class="row-action" data-order-detail="'+o.id+'">Open order</button></span></div>'; }
  function renderPagination(id,count,table) { var host=$('#'+id);var pagesTotal=Math.max(1,Math.ceil(count/PAGE_SIZE));var page=pages[table];host.innerHTML='<span>'+esc(String(count))+' records</span><button data-page-table="'+table+'" data-page="'+Math.max(0,page-1)+'" '+(page===0?'disabled':'')+'>Previous</button><span>Page '+(page+1)+' of '+pagesTotal+'</span><button data-page-table="'+table+'" data-page="'+Math.min(pagesTotal-1,page+1)+'" '+(page>=pagesTotal-1?'disabled':'')+'>Next</button>'; }

  async function loadCustomers() {
    var host=$('#customers-list');host.innerHTML='<div class="loading-state">Loading customers…</div>';
    var from=pages.customers*PAGE_SIZE,to=from+PAGE_SIZE-1,status=$('#customer-status-filter').value;var query=client.from('customers').select('id,customer_code,full_name,whatsapp_number,whatsapp_number_normalized,alternate_number,address,area,customer_type,notes,created_at,is_active',{count:'exact'}).order('full_name').range(from,to);
    if(status==='active')query=query.eq('is_active',true);else if(status==='inactive')query=query.eq('is_active',false);var term=$('#customers-search').value.trim().replace(/[(),%]/g,'');if(term){var digits=normalizePhone(term);var filters=['full_name.ilike.%'+term+'%','whatsapp_number.ilike.%'+term+'%'];if(digits)filters.push('whatsapp_number_normalized.ilike.%'+digits+'%');query=query.or(filters.join(','));}
    var r=await query;if(r.error)throw r.error;lastCustomers=r.data||[];host.innerHTML=lastCustomers.length?dataHeader(['CUSTOMER','WHATSAPP','AREA / TYPE','STATUS',''],lastCustomers.map(customerRow).join('')):empty('No customers found','Add a customer to start a laundry order.');renderPagination('customers-pagination',r.count||0,'customers');
  }
  function customerRow(c) { return '<div class="data-row"><span class="primary-cell"><button class="quiet-link" data-customer-detail="'+c.id+'">'+esc(c.full_name)+'</button><small class="secondary-cell">'+esc(c.customer_code||'Customer')+' · '+esc(c.customer_type||'Regular')+'</small></span><span>'+esc(c.whatsapp_number||'—')+'<small class="secondary-cell">'+esc(c.alternate_number||'')+'</small></span><span>'+esc(c.area||'—')+'<small class="secondary-cell">'+esc(c.address||'')+'</small></span><span>'+pill(c.is_active?'Active':'Inactive',false)+'</span><span class="row-actions"><button class="row-action" data-customer-detail="'+c.id+'">Profile</button></span></div>'; }
  function editCustomer(customer) {
    customer=customer||{};var body='<form id="customer-form" data-id="'+(customer.id||'')+'"><div class="form-grid"><label class="form-field">Full name<input class="form-control" name="full_name" required maxlength="120" value="'+esc(customer.full_name||'')+'"></label><label class="form-field">WhatsApp number<input class="form-control" name="whatsapp_number" required type="tel" inputmode="tel" placeholder="+91 98765 43210" value="'+esc(customer.whatsapp_number||'')+'"></label><label class="form-field">Alternate number<input class="form-control" name="alternate_number" type="tel" value="'+esc(customer.alternate_number||'')+'"></label><label class="form-field">Customer type<select class="form-control" name="customer_type"><option>Regular</option><option>Student</option><option>Family</option><option>Corporate</option></select></label><label class="form-field">Area / neighbourhood<input class="form-control" name="area" maxlength="120" value="'+esc(customer.area||'')+'"></label><label class="form-field">Address<input class="form-control" name="address" maxlength="400" value="'+esc(customer.address||'')+'"></label><label class="form-field full-span">Notes<textarea class="form-control" name="notes" rows="3" maxlength="1000">'+esc(customer.notes||'')+'</textarea></label></div><p class="form-error"></p><div class="form-footer"><button class="button button-outline" type="button" data-close>Cancel</button><button class="button button-green" type="submit">'+(customer.id?'Save customer':'Add customer')+'</button></div></form>';
    openDialog(customer.id?'Edit customer':'Add a customer',body);var select=$('[name=customer_type]');select.value=customer.customer_type||'Regular';
  }
  async function saveCustomer(form) {
    var fd=new FormData(form),id=form.dataset.id||null,phone=String(fd.get('whatsapp_number')||'').trim(),normalized=normalizePhone(phone);
    if(normalized.length!==10){safeError(new Error('Enter a valid 10-digit Indian WhatsApp number.'),form);return;}
    var duplicate=await client.from('customers').select('id').eq('whatsapp_number_normalized',normalized).eq('is_active',true).limit(1);if(duplicate.error){safeError(duplicate.error,form);return;}
    if((duplicate.data||[]).some(function(row){return String(row.id)!==String(id);})){safeError(new Error('An active customer already uses this WhatsApp number.'),form);return;}
    var values={full_name:String(fd.get('full_name')||'').trim(),whatsapp_number:phone,whatsapp_number_normalized:normalized,alternate_number:String(fd.get('alternate_number')||'').trim()||null,customer_type:fd.get('customer_type')||'Regular',area:String(fd.get('area')||'').trim()||null,address:String(fd.get('address')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null};
    var r=id?await client.from('customers').update(values).eq('id',id):await client.from('customers').insert(values);if(r.error){safeError(r.error,form);return;}closeDialog();toast(id?'Customer details saved.':'Customer added.');await loadCustomers();
  }
  async function showCustomer(id) {
    var result=await Promise.all([client.from('customers').select('*').eq('id',id).single(),client.from('orders').select('id,order_number,invoice_number,order_date,status,total_amount,paid_amount,payment_status').eq('customer_id',id).order('order_date',{ascending:false}).limit(50),client.from('subscriptions').select('id,plan_name,start_date,expiry_date,weekly_limit_kg,used_kg,active').eq('customer_id',id).order('created_at',{ascending:false}).limit(10)]);
    result.forEach(function(r){if(r.error)throw r.error;});var c=result[0].data,orders=result[1].data||[],subs=result[2].data||[],outstanding=orders.reduce(function(sum,o){return sum+Math.max(Number(o.total_amount)-Number(o.paid_amount),0);},0);
    var html='<div class="order-detail-grid"><div class="detail-box"><span>WHATSAPP</span><b>'+esc(c.whatsapp_number||'—')+'</b></div><div class="detail-box"><span>AREA</span><b>'+esc(c.area||'—')+'</b></div><div class="detail-box"><span>CUSTOMER CODE</span><b>'+esc(c.customer_code||'—')+'</b></div><div class="detail-box"><span>OUTSTANDING</span><b>'+money(outstanding)+'</b></div></div><p class="detail-section-title">Address &amp; notes</p><p class="form-hint">'+esc(c.address||'No address saved.')+(c.notes?'<br>'+esc(c.notes):'')+'</p><p class="detail-section-title">Order history</p>'+(orders.map(function(o){return '<div class="detail-payment-line"><span><button class="quiet-link" data-open-order="'+o.id+'">'+esc(o.order_number)+'</button> · '+esc(displayDate(o.order_date))+' · '+pill(o.status,false)+'</span><b>'+money(o.total_amount)+'</b></div>';}).join('')||empty('No orders yet',''))+'<p class="detail-section-title">Subscriptions</p>'+(subs.map(function(s){return '<div class="detail-payment-line"><span>'+esc(s.plan_name)+' · '+esc(displayDate(s.start_date))+' – '+esc(displayDate(s.expiry_date))+'</span><b>'+Number(s.used_kg||0)+' / '+Number(s.weekly_limit_kg||0)+' kg</b></div>';}).join('')||'<p class="form-hint">No subscription on file.</p>')+'<div class="detail-actions"><div><button class="button button-outline" data-customer-edit="'+c.id+'">Edit customer</button><button class="button button-outline" data-customer-toggle="'+c.id+'">'+(c.is_active?'Deactivate':'Reactivate')+'</button></div><button class="button button-green" data-action="new-order" data-customer-id="'+c.id+'">Create order</button></div>';
    openDialog(c.full_name,html);
  }
  async function toggleCustomer(id) {
    var c=lastCustomers.find(function(item){return item.id===id;});if(!c){var found=await client.from('customers').select('id,is_active').eq('id',id).single();if(found.error)throw found.error;c=found.data;}
    var r=await client.from('customers').update({is_active:!c.is_active}).eq('id',id);if(r.error)throw r.error;closeDialog();toast(c.is_active?'Customer deactivated.':'Customer reactivated.');loadCustomers();
  }

  async function loadServicesPage() {
    var result=await Promise.all([client.from('services').select('id,service_name,unit_type,rate,active,is_deleted,updated_at').order('service_name'),client.from('service_rate_history').select('id,service_id,old_rate,new_rate,changed_at,changed_by,service:services(service_name)').order('changed_at',{ascending:false}).limit(25)]);
    result.forEach(function(r){if(r.error)throw r.error;});lastServices=result[0].data||[];
    $('#services-list').innerHTML=lastServices.map(function(s){return '<article class="service-admin-card"><div class="panel-head"><div><h3>'+esc(s.service_name)+'</h3><p>'+esc(s.unit_type)+' · '+(s.active&&!s.is_deleted?'<span class="service-state">Active</span>':'<span class="service-state inactive">Inactive</span>')+'</p></div>'+(staff.role==='admin'?'<button class="row-action" data-edit-service="'+s.id+'">Edit</button>':'')+'</div><div class="service-rate-line"><strong>'+money(s.rate)+'</strong><span>per '+esc(s.unit_type==='kg'?'kg':'piece')+'</span></div></article>';}).join('')||empty('No services','Add a service to start billing.');
    $('#rate-history-list').innerHTML=(result[1].data||[]).map(function(h){return '<div class="data-row"><span class="primary-cell">'+esc(h.service&&h.service.service_name||'Service')+'<small class="secondary-cell">'+esc(displayDateTime(h.changed_at))+'</small></span><span>'+money(h.old_rate)+'</span><span>→</span><span>'+money(h.new_rate)+'</span><span>'+esc(h.changed_by||'Admin')+'</span></div>';}).join('')||empty('No rate changes yet','Changes will be recorded here.');
  }
  function editService(service) {
    if(!staff || staff.role!=='admin'){toast('Only an administrator can change service rates.','error');return;}
    service=service||{};var body='<form id="service-form" data-id="'+(service.id||'')+'"><div class="form-grid"><label class="form-field full-span">Service name<input class="form-control" name="service_name" required maxlength="120" value="'+esc(service.service_name||'')+'"></label><label class="form-field">Unit<select class="form-control" name="unit_type"><option value="kg">Kilogram</option><option value="piece">Piece</option></select></label><label class="form-field">Rate (₹)<input class="form-control" name="rate" type="number" min="0.01" step="0.01" required value="'+esc(service.rate||'')+'"></label><label class="form-field"><span>Availability</span><span class="remember-label"><input type="checkbox" name="active" '+(service.active===false?'':'checked')+'> Active for new orders</span></label></div><p class="form-error"></p><div class="form-footer"><button class="button button-outline" type="button" data-close>Cancel</button><button class="button button-green" type="submit">Save service</button></div></form>';
    openDialog(service.id?'Update service':'Add service',body);$('[name=unit_type]').value=service.unit_type||'kg';
  }
  async function saveService(form) {
    if(staff.role!=='admin'){safeError(new Error('Admin access is required.'),form);return;}
    var fd=new FormData(form),id=form.dataset.id||null,values={service_name:String(fd.get('service_name')||'').trim(),unit_type:fd.get('unit_type')||'kg',rate:Number(fd.get('rate')),active:!!form.querySelector('[name=active]').checked,is_deleted:false,updated_at:new Date().toISOString()};
    var r=id?await client.from('services').update(values).eq('id',id):await client.from('services').insert(values);if(r.error){safeError(r.error,form);return;}closeDialog();toast('Service saved.');await loadServicesPage();
  }

  function customerOptions(selected) { return '<option value="">Choose a customer…</option>'+lastCustomers.filter(function(c){return c.is_active;}).map(function(c){return '<option value="'+c.id+'" '+(String(c.id)===String(selected)?'selected':'')+'>'+esc(c.full_name)+' · '+esc(c.whatsapp_number||'')+'</option>';}).join(''); }
  function serviceOptions(selected) { return '<option value="">Choose a service…</option>'+lastServices.filter(function(s){return s.active&&!s.is_deleted;}).map(function(s){return '<option value="'+s.id+'" data-rate="'+s.rate+'" data-unit="'+esc(s.unit_type)+'" '+(String(s.id)===String(selected)?'selected':'')+'>'+esc(s.service_name)+' · '+money(s.rate)+' / '+esc(s.unit_type)+'</option>';}).join(''); }
  async function newOrder(customerId) {
    var result=await Promise.all([client.from('customers').select('id,customer_code,full_name,whatsapp_number,is_active').eq('is_active',true).order('full_name').limit(1000),client.from('services').select('id,service_name,unit_type,rate,active,is_deleted').eq('active',true).eq('is_deleted',false).order('service_name')]);
    result.forEach(function(r){if(r.error)throw r.error;});lastCustomers=result[0].data||[];lastServices=result[1].data||[];
    var delivery=new Date();delivery.setDate(delivery.getDate()+2);var body='<form id="order-form"><div class="form-grid"><label class="form-field">Customer<select class="form-control" name="customer_id" required>'+customerOptions(customerId)+'</select></label><label class="form-field">Expected delivery<input class="form-control" name="expected_delivery_date" type="date" min="'+indiaDate(new Date())+'" value="'+indiaDate(delivery)+'" required></label><label class="form-field">Discount (₹)<input class="form-control" name="discount" id="order-discount" type="number" min="0" step="0.01" value="0"></label><label class="form-field">Notes<input class="form-control" name="notes" maxlength="500" placeholder="Optional order notes"></label></div><div class="line-item-head"><span>SERVICE</span><span>QTY</span><span>RATE</span><span>AMOUNT</span><span></span></div><div id="order-lines">'+orderLine()+'</div><button class="add-line" type="button" data-add-line>＋ Add another service</button><div class="order-total-preview"><span>Subtotal <b id="order-subtotal">₹0.00</b></span><span>Total <b id="order-total">₹0.00</b></span></div><p class="form-hint">Rates are copied from the live service list when the order is created. Payment can be recorded after the invoice is ready.</p><p class="form-error"></p><div class="form-footer"><button class="button button-outline" type="button" data-close>Cancel</button><button class="button button-green" type="submit">Create order &amp; invoice</button></div></form>';
    openDialog('Create a laundry order',body);updateOrderPreview();
  }
  function orderLine(serviceId,quantity) { return '<div class="line-item"><select class="order-service" required>'+serviceOptions(serviceId)+'</select><input class="order-qty" type="number" min="0.01" step="0.01" value="'+(quantity||1)+'" aria-label="Quantity"><span class="line-amount line-rate">—</span><span class="line-amount">₹0.00</span><button class="remove-line" type="button" data-remove-line aria-label="Remove item">×</button></div>'; }
  function addOrderLine() { var host=$('#order-lines');if(host)host.insertAdjacentHTML('beforeend',orderLine()); }
  function updateOrderPreview() {
    var subtotal=0;$$('.line-item').forEach(function(row){var select=$('.order-service',row),option=select&&select.selectedOptions[0],rate=Number(option&&option.dataset.rate||0),qty=Number($('.order-qty',row).value||0),amount=rate*qty;$('.line-rate',row).textContent=rate?money(rate)+' / '+(option.dataset.unit==='kg'?'kg':'pc'):'—';$('.line-amount',row).textContent=money(amount);subtotal+=amount;});
    var discount=Math.max(0,Number($('#order-discount')&&$('#order-discount').value||0));$('#order-subtotal').textContent=money(subtotal);$('#order-total').textContent=money(Math.max(0,subtotal-discount));
  }
  async function saveOrder(form) {
    var fd=new FormData(form),items=[];$$('.line-item',form).forEach(function(row){var serviceId=$('.order-service',row).value,qty=Number($('.order-qty',row).value);if(serviceId&&qty>0)items.push({service_id:Number(serviceId),quantity:qty});});
    if(!items.length){safeError(new Error('Add at least one service and quantity.'),form);return;}
    var button=form.querySelector('button[type="submit"]');setBusy(button,true,'Creating order…');form.dataset.idempotencyKey=form.dataset.idempotencyKey||crypto.randomUUID();
    try{var response=await client.rpc('create_laundry_order',{p_customer_id:Number(fd.get('customer_id')),p_expected_delivery_date:fd.get('expected_delivery_date'),p_discount:Number(fd.get('discount')||0),p_paid_amount:0,p_payment_method:'Cash',p_notes:String(fd.get('notes')||''),p_idempotency_key:form.dataset.idempotencyKey,p_items:items});
      if(response.error){safeError(response.error,form);return;}var id=response.data&&response.data.id;if(!id){safeError(new Error('The database did not return an order ID.'),form);return;}
      closeDialog();toast('Order '+(response.data.order_number||'')+' created.');await loadOrders();await showOrder(Number(id));
    }catch(error){safeError(error,form);}finally{setBusy(button,false);}
  }

  async function showOrder(id) {
    var result=await Promise.all([client.from('orders').select('*,customer:customers(id,customer_code,full_name,whatsapp_number,address,area)').eq('id',id).single(),client.from('order_items').select('id,item_name,quantity,unit,rate,amount,service:services(service_name)').eq('order_id',id).order('id'),client.from('payments').select('id,amount,payment_method,payment_date,reference_number,notes').eq('order_id',id).order('payment_date',{ascending:true})]);
    result.forEach(function(r){if(r.error)throw r.error;});var o=result[0].data,items=result[1].data||[],payments=result[2].data||[],customer=o.customer||{};var balance=Math.max(Number(o.total_amount||0)-Number(o.paid_amount||0),0),rank=STATUS.indexOf(o.status);
    var stepper='<div class="workflow">'+STATUS.map(function(s,i){var cls=i<rank?'done':i===rank?'current':'';return '<div class="workflow-step '+cls+'"><i></i>'+esc(s)+'</div>';}).join('')+'</div>';
    var lines=items.map(function(item){return '<tr><td>'+esc(item.item_name||item.service&&item.service.service_name||'Laundry service')+'</td><td>'+Number(item.quantity||0)+' '+esc(item.unit||'')+'</td><td>'+money(item.rate)+'</td><td>'+money(item.amount)+'</td></tr>';}).join('');
    var paymentList=payments.map(function(p){return '<div class="detail-payment-line"><span>'+esc(displayDateTime(p.payment_date))+' · '+esc(p.payment_method)+' '+(p.reference_number?'· '+esc(p.reference_number):'')+'</span><b>'+money(p.amount)+'</b></div>';}).join('')||'<p class="form-hint">No payments recorded.</p>';
    var next=rank>=0&&rank<STATUS.length-1?STATUS[rank+1]:null;
    var html=stepper+'<div class="order-detail-grid"><div class="detail-box"><span>CUSTOMER</span><b>'+esc(customer.full_name||'Customer')+'</b><small class="secondary-cell">'+esc(customer.whatsapp_number||'')+'</small></div><div class="detail-box"><span>ORDER STATUS</span><b>'+pill(o.status,false)+'</b></div><div class="detail-box"><span>ORDER DATE</span><b>'+esc(displayDateTime(o.order_date))+'</b></div><div class="detail-box"><span>EXPECTED DELIVERY</span><b>'+esc(displayDate(o.expected_delivery_date))+'</b></div><div class="detail-box"><span>INVOICE</span><b>'+esc(o.invoice_number||o.order_number)+'</b></div><div class="detail-box"><span>ASSIGNED PICKUP</span><b>'+esc(o.pickup_assigned_to||'Not assigned')+'</b></div></div><table class="invoice-table"><thead><tr><th>Service</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+lines+'</tbody></table><div class="invoice-totals"><div class="invoice-total-row"><span>Subtotal</span><strong>'+money(o.subtotal)+'</strong></div><div class="invoice-total-row"><span>Discount</span><strong>− '+money(o.discount)+'</strong></div><div class="invoice-total-row grand"><span>Total</span><strong>'+money(o.total_amount)+'</strong></div><div class="invoice-total-row"><span>Paid</span><strong>'+money(o.paid_amount)+'</strong></div><div class="invoice-total-row"><span>Outstanding</span><strong>'+money(balance)+'</strong></div><div class="invoice-total-row"><span>Payment status</span><strong>'+pill(o.payment_status,true)+'</strong></div></div><p class="detail-section-title">Payment history</p>'+paymentList+'<div class="detail-actions"><div><button class="button button-outline" data-print-invoice="'+id+'">Print / Save PDF</button>'+(balance>0?'<button class="button button-outline" data-take-payment="'+id+'">＋ Record payment</button>':'')+'</div><div>'+(next?'<button class="button button-green" data-advance-order data-id="'+id+'" data-next="'+esc(next)+'">Move to '+esc(next)+' <span>→</span></button>':'')+'</div></div>';
    openDialog('Order '+(o.order_number||''),html,'');
  }
  async function advanceOrder(id,next) {
    if(next==='Pickup Assigned'){
      var assigned=window.prompt('Who is assigned to this pickup? Enter a team member name.');if(assigned===null)return;if(!assigned.trim()){toast('Enter the pickup assignee before moving the order.','error');return;}
    }
    var r=await client.rpc('change_order_status',{p_order_id:id,p_status:next});if(r.error){toast(r.error.message,'error');return;}
    if(next==='Pickup Assigned'){var u=await client.from('orders').update({pickup_assigned_to:assigned.trim()}).eq('id',id);if(u.error){toast('Status moved, but the pickup assignee could not be saved: '+u.error.message,'error');return;}}
    toast('Order moved to '+next+'.');await loadOrders();await showOrder(id);await updatePendingBadge();
  }
  function paymentForm(orderId) {
    var html='<form id="payment-form" data-order="'+orderId+'"><div class="form-grid"><label class="form-field">Amount (₹)<input class="form-control" name="amount" type="number" min="0.01" step="0.01" required></label><label class="form-field">Method<select class="form-control" name="method"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Other</option></select></label><label class="form-field">Payment date<input class="form-control" name="payment_date" type="date" value="'+indiaDate(new Date())+'" required></label><label class="form-field">Reference number<input class="form-control" name="reference" maxlength="100" placeholder="Optional transaction reference"></label><label class="form-field full-span">Notes<textarea class="form-control" name="notes" rows="2" maxlength="500"></textarea></label></div><p class="form-hint">The database checks that a payment is positive and does not exceed the remaining balance.</p><p class="form-error"></p><div class="form-footer"><button class="button button-outline" type="button" data-close>Cancel</button><button class="button button-green" type="submit">Record payment</button></div></form>';
    openDialog('Record a payment',html);
  }
  async function savePayment(form) {
    var fd=new FormData(form),amount=Number(fd.get('amount'));if(amount<=0){safeError(new Error('Enter a payment greater than zero.'),form);return;}
    var button=form.querySelector('button[type="submit"]');setBusy(button,true,'Recording payment…');form.dataset.idempotencyKey=form.dataset.idempotencyKey||crypto.randomUUID();
    try{var paymentDate=new Date(String(fd.get('payment_date'))+'T12:00:00+05:30').toISOString();var response=await client.rpc('record_laundry_payment',{p_order_id:Number(form.dataset.order),p_amount:amount,p_method:fd.get('method'),p_reference:String(fd.get('reference')||''),p_idempotency_key:form.dataset.idempotencyKey,p_payment_date:paymentDate,p_notes:String(fd.get('notes')||'').trim()||null});
      if(response.error){safeError(response.error,form);return;}var id=Number(form.dataset.order);closeDialog();toast('Payment recorded.');await loadPayments();await showOrder(id);
    }catch(error){safeError(error,form);}finally{setBusy(button,false);}
  }

  async function loadPayments() {
    var host=$('#payments-list');host.innerHTML='<div class="loading-state">Loading payment history…</div>';
    var from=pages.payments*PAGE_SIZE,to=from+PAGE_SIZE-1;var query=client.from('payments').select('id,order_id,amount,payment_method,payment_date,reference_number,order:orders(order_number,customer:customers(full_name))',{count:'exact'}).order('payment_date',{ascending:false}).range(from,to);
    var day=$('#payment-date-filter').value;if(day){var bounds=timeBounds(day);query=query.gte('payment_date',bounds.from).lte('payment_date',bounds.to);}
    var r=await query;if(r.error)throw r.error;var rows=r.data||[];
    var sum=rows.reduce(function(a,x){return a+Number(x.amount||0);},0);$('#payment-metrics').innerHTML=metric('PAYMENTS SHOWN',rows.length,'↙','Based on the current filters')+metric('COLLECTED SHOWN',compactMoney(sum),'₹','Payments in this page','metric-warm')+metric('TODAY’S COLLECTION',compactMoney(await collectionOn(indiaDate(new Date()))),'✓','All payments collected today')+metric('PAYMENT METHODS',new Set(rows.map(function(x){return x.payment_method;})).size,'◇','Methods used on this page');
    host.innerHTML=rows.length?dataHeader(['CUSTOMER / ORDER','PAYMENT DATE','METHOD / REFERENCE','AMOUNT',''],rows.map(function(p){return '<div class="data-row"><span class="primary-cell">'+esc(p.order&&p.order.customer&&p.order.customer.full_name||'Customer')+'<small class="secondary-cell"><button class="quiet-link" data-payment-order="'+p.order_id+'">'+esc(p.order&&p.order.order_number||'Order')+'</button></small></span><span>'+esc(displayDateTime(p.payment_date))+'</span><span>'+esc(p.payment_method)+'<small class="secondary-cell">'+esc(p.reference_number||'—')+'</small></span><span>'+money(p.amount)+'</span><span class="row-actions"><button class="row-action" data-payment-order="'+p.order_id+'">Open order</button></span></div>';}).join('')):empty('No payments found','Payments appear after they are recorded against an order.');renderPagination('payments-pagination',r.count||0,'payments');
  }
  async function collectionOn(day) { var b=timeBounds(day);var r=await client.from('payments').select('amount').gte('payment_date',b.from).lte('payment_date',b.to).limit(5000);if(r.error)throw r.error;return (r.data||[]).reduce(function(sum,x){return sum+Number(x.amount||0);},0); }

  async function loadSubscriptions() {
    var search=$('#subscriptions-search').value.trim().toLowerCase(),filter=$('#subscription-status-filter').value,day=indiaDate(new Date());
    var r=await client.from('subscriptions').select('id,customer_id,plan_name,start_date,expiry_date,registration_fee,weekly_limit_kg,used_kg,monthly_amount,active,notes,usage_week_start,customer:customers(full_name,whatsapp_number,area)').order('expiry_date',{ascending:true}).limit(1000);if(r.error)throw r.error;
    lastSubscriptions=r.data||[];var shown=lastSubscriptions.filter(function(s){var active=!!s.active&&s.expiry_date>=day;if(filter==='active'&&!active)return false;if(filter==='expired'&&active)return false;if(search&&!(String(s.plan_name).toLowerCase().indexOf(search)>=0||String(s.customer&&s.customer.full_name||'').toLowerCase().indexOf(search)>=0))return false;return true;});
    $('#subscriptions-list').innerHTML=shown.length?shown.map(function(s){var lim=Number(s.weekly_limit_kg||0),used=Number(s.used_kg||0),remaining=Math.max(lim-used,0),pct=lim?Math.min(100,used/lim*100):0;return '<article class="subscription-card"><h3>'+esc(s.customer&&s.customer.full_name||'Customer')+'</h3><p class="plan-name">'+esc(s.plan_name)+'</p><div class="subscription-meta"><div><span>REGISTRATION</span><b>'+money(s.registration_fee)+'</b></div><div><span>MONTHLY</span><b>'+money(s.monthly_amount)+'</b></div><div><span>EXPIRES</span><b>'+esc(displayDate(s.expiry_date))+'</b></div><div><span>WEEKLY ALLOWANCE</span><b>'+lim+' kg</b></div><div><span>REMAINING THIS WEEK</span><b>'+remaining+' kg</b></div></div><div class="usage-meter"><span style="width:'+pct+'%"></span></div><div class="usage-caption"><span>'+used+' kg used</span><span>'+esc(s.active&&s.expiry_date>=day?'Active':'Inactive')+'</span></div><div class="row-actions"><button class="row-action" data-toggle-subscription="'+s.id+'">'+(s.active?'Deactivate':'Reactivate')+'</button></div></article>';}).join(''):empty('No subscriptions match','Create a plan to track weekly laundry allowance.');
  }
  async function newSubscription() {
    var r=await client.from('customers').select('id,full_name,whatsapp_number,is_active').eq('is_active',true).order('full_name').limit(1000);if(r.error)throw r.error;lastCustomers=r.data||[];
    var opts=PLANS.map(function(p){return '<option value="'+esc(p.name)+'" data-registration="'+p.registration+'" data-monthly="'+p.monthly+'" data-kg="'+p.kg+'">'+esc(p.name)+' · '+money(p.monthly)+'/month</option>';}).join('');var start=indiaDate(new Date()),expiry=new Date();expiry.setFullYear(expiry.getFullYear()+1);
    var body='<form id="subscription-form"><div class="form-grid"><label class="form-field">Customer<select class="form-control" name="customer_id" required>'+customerOptions('')+'</select></label><label class="form-field">Plan<select class="form-control" name="plan_name" required><option value="">Choose a plan…</option>'+opts+'</select></label><label class="form-field">Start date<input class="form-control" name="start_date" type="date" value="'+start+'" required></label><label class="form-field">Expiry date<input class="form-control" name="expiry_date" type="date" value="'+indiaDate(expiry)+'" required></label><label class="form-field">Registration fee (₹)<input class="form-control" name="registration_fee" type="number" min="0" step="0.01" required></label><label class="form-field">Weekly kg allowance<input class="form-control" name="weekly_limit_kg" type="number" min="0.01" step="0.01" required></label><label class="form-field">Monthly amount (₹)<input class="form-control" name="monthly_amount" type="number" min="0" step="0.01" required></label><label class="form-field full-span">Notes<input class="form-control" name="notes" maxlength="500"></label></div><p class="form-error"></p><div class="form-footer"><button class="button button-outline" type="button" data-close>Cancel</button><button class="button button-green" type="submit">Save subscription</button></div></form>';
    openDialog('Start a subscription',body);$('[name=plan_name]').addEventListener('change',function(){var option=this.selectedOptions[0];$('[name=registration_fee]').value=option.dataset.registration||'';$('[name=weekly_limit_kg]').value=option.dataset.kg||'';$('[name=monthly_amount]').value=option.dataset.monthly||'';});
  }
  async function saveSubscription(form) {
    var fd=new FormData(form),week=new Date(fd.get('start_date')+'T12:00:00');var day=(week.getDay()+6)%7;week.setDate(week.getDate()-day);
    var values={customer_id:Number(fd.get('customer_id')),plan_name:fd.get('plan_name'),start_date:fd.get('start_date'),expiry_date:fd.get('expiry_date'),registration_fee:Number(fd.get('registration_fee')),weekly_limit_kg:Number(fd.get('weekly_limit_kg')),used_kg:0,monthly_amount:Number(fd.get('monthly_amount')),active:true,notes:String(fd.get('notes')||'').trim()||null,usage_week_start:indiaDate(week)};
    if(values.expiry_date<values.start_date){safeError(new Error('Expiry date must be on or after the start date.'),form);return;}
    var r=await client.from('subscriptions').insert(values);if(r.error){safeError(r.error,form);return;}closeDialog();toast('Subscription added.');await loadSubscriptions();
  }
  async function toggleSubscription(id) { var item=lastSubscriptions.find(function(x){return x.id===id;});if(!item)return;var r=await client.from('subscriptions').update({active:!item.active}).eq('id',id);if(r.error)throw r.error;toast(item.active?'Subscription deactivated.':'Subscription reactivated.');await loadSubscriptions(); }

  async function loadReports() {
    var month=$('#report-month').value||indiaDate(new Date()).slice(0,7),from=month+'-01',parts=month.split('-'),lastDay=new Date(Number(parts[0]),Number(parts[1]),0).getDate(),to=month+'-'+String(lastDay).padStart(2,'0'),bounds=timeBounds(to),start=from+'T00:00:00+05:30';
    var r=await Promise.all([client.from('orders').select('id,order_number,customer_id,order_date,status,total_amount,paid_amount,expected_delivery_date,customer:customers(full_name,whatsapp_number)').gte('order_date',start).lte('order_date',bounds.to).order('order_date',{ascending:false}).limit(5000),client.from('payments').select('id,amount,payment_date,order_id').gte('payment_date',start).lte('payment_date',bounds.to).order('payment_date',{ascending:false}).limit(5000),client.from('order_items').select('amount,service:services(service_name)').limit(5000),client.from('orders').select('id,order_number,customer_id,order_date,status,total_amount,paid_amount,customer:customers(full_name,whatsapp_number)').gt('total_amount',0).order('order_date',{ascending:false}).limit(5000)]);
    r.forEach(function(x){if(x.error)throw x.error;});var orders=r[0].data||[],payments=r[1].data||[],items=r[2].data||[],openOrders=(r[3].data||[]).filter(function(o){return Number(o.total_amount)>Number(o.paid_amount);});
    var sales=orders.reduce(function(a,o){return a+Number(o.total_amount||0);},0),collection=payments.reduce(function(a,p){return a+Number(p.amount||0);},0),outstanding=openOrders.reduce(function(a,o){return a+Math.max(Number(o.total_amount)-Number(o.paid_amount),0);},0);
    $('#report-metrics').innerHTML=metric('SALES',compactMoney(sales),'₹','Orders placed in '+month,'metric-warm')+metric('COLLECTION',compactMoney(collection),'↙','Payments received in '+month)+metric('OUTSTANDING',compactMoney(outstanding),'!','Current open order balances','metric-alert')+metric('ORDERS',orders.length,'▤','Orders created in this month');
    drawChart($('#report-chart'),orders,payments,7);$('#report-service-mix').innerHTML=serviceMix(items);
    $('#outstanding-list').innerHTML=openOrders.slice(0,100).map(function(o){var due=Number(o.total_amount)-Number(o.paid_amount);return '<div class="data-row"><span class="primary-cell"><button class="quiet-link" data-order-detail="'+o.id+'">'+esc(o.order_number)+'</button><small class="secondary-cell">'+esc(o.customer&&o.customer.full_name||'Customer')+'</small></span><span>'+esc(o.customer&&o.customer.whatsapp_number||'—')+'</span><span>'+money(o.total_amount)+'</span><span>'+money(o.paid_amount)+'</span><span class="primary-cell">'+money(due)+'</span></div>';}).join('')||empty('No outstanding balances','All recorded orders are paid.');
  }
  function exportOutstanding() {
    var rows=$$('#outstanding-list .data-row').map(function(row){return Array.prototype.map.call(row.querySelectorAll('span'),function(cell){return '"'+cell.innerText.replace(/"/g,'""').replace(/\s+/g,' ').trim()+'"';}).join(',');});var csv=['"Order / customer","Phone","Total","Paid","Outstanding"'].concat(rows).join('\r\n');downloadFile('cleaneazy-outstanding-'+indiaDate(new Date())+'.csv',csv,'text/csv;charset=utf-8');
  }

  async function loadMessages() {
    var query=client.from('whatsapp_messages').select('id,order_id,customer_id,event,recipient,template_name,status,attempts,provider_message_id,last_error,created_at,sent_at,next_attempt_at,customer:customers(full_name),order:orders(order_number)').order('created_at',{ascending:false}).limit(200);
    var status=$('#message-status-filter').value;if(status)query=query.eq('status',status);var r=await query;if(r.error)throw r.error;var rows=r.data||[];
    $('#messages-list').innerHTML=rows.length?dataHeader(['CUSTOMER / EVENT','CREATED','TEMPLATE / ATTEMPTS','STATUS',''],rows.map(function(m){return '<div class="data-row"><span class="primary-cell">'+esc(m.customer&&m.customer.full_name||m.recipient)+'<small class="secondary-cell">'+esc(m.event)+' · '+esc(m.order&&m.order.order_number||'')+'</small></span><span>'+esc(displayDateTime(m.created_at))+'<small class="secondary-cell">'+esc(m.sent_at?'Sent '+displayDateTime(m.sent_at):'')+'</small></span><span>'+esc(m.template_name||'Template pending')+'<small class="secondary-cell">Attempts '+Number(m.attempts||0)+'</small></span><span>'+pill(m.status,false)+'</span><span class="row-actions">'+(m.last_error?'<span class="secondary-cell" title="'+esc(m.last_error)+'">See error</span>':'')+(staff&&staff.role==='admin'&&m.status==='failed'?'<button class="row-action" data-retry-message="'+m.id+'">Retry</button>':'')+'</span></div>';}).join('')):empty('Queue is clear','Customer updates will appear here after order activity.');
    var pending=rows.filter(function(m){return m.status==='pending';}).length;if(!window.CLEANEAZY_WHATSAPP_READY)$('#whatsapp-config-note').textContent='Meta WhatsApp credentials and approved templates are not configured yet. '+pending+' message(s) may be queued; delivery will remain paused until configuration is complete.';
  }
  async function processMessages() {
    var button=$('#process-messages');setBusy(button,true,'Checking message queue…');
    try { var r=await client.functions.invoke('send-whatsapp',{body:{limit:10}});if(r.error)throw r.error;var result=r.data||{};if(result.code==='WHATSAPP_NOT_CONFIGURED'){toast('Meta WhatsApp Cloud API credentials are missing. Queue left untouched.','info');return;}var done=(result.results||[]).filter(function(x){return x.ok;}).length;toast(done+' message(s) sent.');await loadMessages(); }
    catch(error){var message=error.message||'WhatsApp queue could not run.';if(message.indexOf('503')>=0||message.indexOf('NOT_CONFIGURED')>=0)message='Meta WhatsApp credentials are not configured yet. The queue is still available.';toast(message,'error');}
    finally{setBusy(button,false);}
  }

  async function retryMessage(id) {
    if(!staff||staff.role!=='admin'){toast('Administrator access is required to retry a message.','error');return;}
    var r=await client.from('whatsapp_messages').update({status:'pending',attempts:0,next_attempt_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',id).eq('status','failed');
    if(r.error)throw r.error;toast('Message returned to the queue.');await loadMessages();
  }

  async function loadReminders() {
    if(!staff||staff.role!=='admin')return;
    var query=client.from('reminders').select('id,customer_id,order_id,reminder_type,scheduled_at,message,status,sent_at,attempts,last_error,customer:customers(full_name,whatsapp_number),order:orders(order_number)').order('scheduled_at',{ascending:false}).limit(300);
    var status=$('#reminder-status-filter').value;if(status)query=query.eq('status',status);var r=await query;if(r.error)throw r.error;var rows=r.data||[];
    $('#reminders-list').innerHTML=rows.length?dataHeader(['CUSTOMER / TYPE','SCHEDULED','MESSAGE','STATUS',''],rows.map(function(item){return '<div class="data-row"><span class="primary-cell">'+esc(item.customer&&item.customer.full_name||'Customer')+'<small class="secondary-cell">'+esc(item.reminder_type)+(item.order&&item.order.order_number?' · '+esc(item.order.order_number):'')+'</small></span><span>'+esc(displayDateTime(item.scheduled_at))+'<small class="secondary-cell">'+Number(item.attempts||0)+' attempts</small></span><span class="primary-cell">'+esc(item.message||'—')+(item.last_error?'<small class="secondary-cell">'+esc(item.last_error)+'</small>':'')+'</span><span>'+pill(item.status,false)+'</span><span class="row-actions">'+(item.status==='pending'?'<button class="row-action" data-cancel-reminder="'+item.id+'">Cancel</button>':'')+'</span></div>';}).join('')):empty('No reminders yet','Schedule one to see it here.');
  }

  async function newReminder() {
    if(!staff||staff.role!=='admin'){toast('Administrator access is required.','error');return;}
    var r=await client.from('customers').select('id,full_name,whatsapp_number,is_active').eq('is_active',true).order('full_name').limit(1000);if(r.error)throw r.error;lastCustomers=r.data||[];
    var types=['Laundry Reminder','Outstanding Reminder','Subscription Expiry'].map(function(name){return '<option>'+name+'</option>';}).join('');
    var body='<form id="reminder-form"><div class="form-grid"><label class="form-field">Customer<select class="form-control" name="customer_id" required>'+customerOptions('')+'</select></label><label class="form-field">Reminder type<select class="form-control" name="reminder_type">'+types+'</select></label><label class="form-field full-span">Schedule date and time (Pune time)<input class="form-control" name="scheduled_at" type="datetime-local" value="'+indiaDate(new Date(Date.now()+86400000))+'T10:00" required></label><label class="form-field full-span">Message<textarea class="form-control" name="message" rows="3" maxlength="1000" placeholder="A helpful message to send using the approved WhatsApp template"></textarea></label></div><p class="form-hint">The hourly scheduler will queue this reminder when it is due. Ensure the matching WhatsApp template is approved in Meta.</p><p class="form-error"></p><div class="form-footer"><button class="button button-outline" type="button" data-close>Cancel</button><button class="button button-green" type="submit">Schedule reminder</button></div></form>';
    openDialog('Schedule a reminder',body);
  }

  async function saveReminder(form) {
    var fd=new FormData(form),local=String(fd.get('scheduled_at')||''),scheduledAt;
    try{scheduledAt=new Date(local+':00+05:30').toISOString();}catch(_){safeError(new Error('Choose a valid date and time.'),form);return;}
    if(new Date(scheduledAt).getTime()<Date.now()){safeError(new Error('Choose a future time.'),form);return;}
    var type=String(fd.get('reminder_type')),custom=String(fd.get('message')||'').trim(),defaults={'Laundry Reminder':'It may be time for your next laundry pickup. Reply to schedule one.','Outstanding Reminder':'You have an outstanding CleanEazy order balance. Please contact us if you have already paid.','Subscription Expiry':'Your CleanEazy subscription is due for renewal.'};
    var button=form.querySelector('button[type="submit"]');setBusy(button,true,'Scheduling…');
    try{var r=await client.from('reminders').insert({customer_id:Number(fd.get('customer_id')),reminder_type:type,scheduled_at:scheduledAt,message:custom||defaults[type],status:'pending',idempotency_key:'manual:'+crypto.randomUUID()});if(r.error){safeError(r.error,form);return;}closeDialog();toast('Reminder scheduled.');await loadReminders();}
    catch(error){safeError(error,form);}finally{setBusy(button,false);}
  }

  async function cancelReminder(id) {
    if(!staff||staff.role!=='admin')return;var r=await client.from('reminders').update({status:'cancelled'}).eq('id',id).eq('status','pending');if(r.error)throw r.error;toast('Reminder cancelled.');await loadReminders();
  }

  async function fetchAll(table) {
    var rows=[],offset=0,chunk=1000;while(true){var r=await client.from(table).select('*').order('id',{ascending:true}).range(offset,offset+chunk-1);if(r.error)throw r.error;var batch=r.data||[];rows=rows.concat(batch);if(batch.length<chunk)break;offset+=chunk;if(offset>=100000)throw new Error('Export stopped at 100,000 records for '+table+' to protect browser memory.');}return rows;
  }
  async function createBackup() {
    if(!staff||staff.role!=='admin'){toast('Only an administrator can create full business backups.','error');return;}
    var button=$('#create-backup');setBusy(button,true,'Preparing private JSON…');
    try { var data={};for(var i=0;i<TABLES.length;i++)data[TABLES[i]]=await fetchAll(TABLES[i]);var counts={};TABLES.forEach(function(t){counts[t]=data[t].length;});var payload={format:'cleaneazy-backup',version:1,exported_at:new Date().toISOString(),business:'CleanEazy Laundry',data:data,counts:counts};
      downloadFile('CleanEazy-backup-'+indiaDate(new Date())+'.json',JSON.stringify(payload,null,2),'application/json');
      var saved=await client.from('backup_exports').insert({created_by:user.id,export_type:'json',record_counts:counts});if(saved.error)throw saved.error;toast('Backup downloaded with '+Object.values(counts).reduce(function(a,b){return a+b;},0)+' records.');await loadBackupHistory();
    } catch(error){fail(error,'Backup export failed');} finally{setBusy(button,false);}
  }
  async function restoreBackup(event) {
    var file=event.target.files&&event.target.files[0];if(!file)return;if(!staff||staff.role!=='admin'){toast('Only an administrator can restore a backup.','error');event.target.value='';return;}
    try { var text=await file.text(),backup=JSON.parse(text);if(backup.format!=='cleaneazy-backup'||backup.version!==1||!backup.data)throw new Error('This file is not a supported CleanEazy backup.');
      var counts=backup.counts||{};var summary=Object.keys(counts).map(function(k){return k+': '+counts[k];}).join('\n');if(!window.confirm('Restore this CleanEazy backup?\n\nExisting matching IDs will be updated. New linked records will be inserted. Reminder and unsent WhatsApp work stays paused for review.\n\n'+summary))return;
      var result=await client.rpc('restore_cleanEazy_backup',{p_backup:backup});if(result.error)throw result.error;toast('Restore completed. '+JSON.stringify(result.data&&result.data.counts||result.data));await loadBackupHistory();
    } catch(error){fail(error,'Restore failed');} finally{event.target.value='';}
  }
  function downloadFile(name,content,type) { var blob=new Blob([content],{type:type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();window.setTimeout(function(){URL.revokeObjectURL(url);},1500); }
  async function loadBackupHistory() {
    if(!staff||staff.role!=='admin'){ $('#backup-history').innerHTML=empty('Administrator access only','');return; }
    var r=await client.from('backup_exports').select('id,created_at,export_type,record_counts').order('created_at',{ascending:false}).limit(30);if(r.error)throw r.error;
    $('#backup-history').innerHTML=(r.data||[]).map(function(b){var n=Object.values(b.record_counts||{}).reduce(function(a,x){return a+Number(x||0);},0);return '<div class="data-row"><span class="primary-cell">'+esc(b.export_type||'JSON backup')+'<small class="secondary-cell">'+esc(displayDateTime(b.created_at))+'</small></span><span>'+n+' records</span><span class="hide-mobile">'+esc(Object.keys(b.record_counts||{}).length)+' record types</span><span></span><span></span></div>';}).join('')||empty('No exports yet','Your first backup will appear here.');
  }

  async function loadTeam() {
    if(!staff||staff.role!=='admin'){ $('#team-list').innerHTML=empty('Administrator access only','');return; }
    var r=await client.functions.invoke('manage-staff',{body:{action:'list'}});if(r.error)throw r.error;var rows=r.data&&r.data.members||[];
    $('#team-list').innerHTML=rows.length?dataHeader(['TEAM MEMBER','EMAIL','ROLE','STATUS',''],rows.map(function(m){return '<div class="data-row"><span class="primary-cell">'+esc(m.display_name||m.email||'Team member')+'<small class="secondary-cell">'+(m.user_id===user.id?'You':'Team account')+'</small></span><span>'+esc(m.email||'—')+'</span><span><select class="form-control" data-team-update="role" data-user-id="'+esc(m.user_id)+'"><option value="staff" '+(m.role==='staff'?'selected':'')+'>Staff</option><option value="admin" '+(m.role==='admin'?'selected':'')+'>Admin</option></select></span><span>'+pill(m.active?'Active':'Inactive',false)+'</span><span class="row-actions">'+(m.user_id!==user.id?'<button class="row-action" data-user-id="'+esc(m.user_id)+'" data-team-update="active">'+(m.active?'Deactivate':'Reactivate')+'</button>':'<span class="secondary-cell">Current admin</span>')+'</span></div>';}).join('')):empty('No team accounts','Invite the first CleanEazy teammate.');
  }
  async function inviteStaff(event) {
    event.preventDefault();if(staff.role!=='admin'){toast('Administrator access is required.','error');return;}var button=event.target.querySelector('button[type=submit]');setBusy(button,true,'Sending invite…');
    try{var r=await client.functions.invoke('manage-staff',{body:{action:'invite',email:$('#invite-email').value.trim(),display_name:$('#invite-name').value.trim(),redirect_to:window.location.origin+window.location.pathname}});if(r.error)throw r.error;event.target.reset();toast('Team invitation sent.');await loadTeam();}
    catch(error){fail(error,'Invitation could not be sent');}finally{setBusy(button,false);}
  }
  async function updateTeamMember(id,action) {
    if(!staff||staff.role!=='admin'||id===user.id){toast('You can’t change your own administrator access here.','error');return;}
    var member={user_id:id};if(action==='role'){var select=$('[data-team-update="role"][data-user-id="'+CSS.escape(id)+'"]');member.role=select.value;}else {var item=await client.from('staff_users').select('active').eq('user_id',id).single();if(item.error)throw item.error;member.active=!item.data.active;}
    var r=await client.functions.invoke('manage-staff',{body:{action:'update',member:member}});if(r.error)throw r.error;toast('Team access updated.');await loadTeam();
  }

  async function loadSettings() {
    if(!staff||staff.role!=='admin')return;var r=await client.from('business_settings').select('*').order('id').limit(1).maybeSingle();if(r.error)throw r.error;lastSettings=r.data;
    if(!lastSettings){toast('Business settings have not been initialized.','error');return;}
    $('#setting-business-name').value=lastSettings.business_name||'CleanEazy Laundry';$('#setting-phone').value=lastSettings.phone||'';$('#setting-whatsapp').value=lastSettings.whatsapp||'';$('#setting-email').value=lastSettings.email||'';$('#setting-gstin').value=lastSettings.gstin||'';$('#setting-currency').value=lastSettings.currency||'INR';$('#setting-address').value=lastSettings.address||'';
  }
  async function saveSettings() {
    if(!staff||staff.role!=='admin')return;var button=$('#save-settings');setBusy(button,true,'Saving…');
    try{var values={business_name:$('#setting-business-name').value.trim(),phone:$('#setting-phone').value.trim()||null,whatsapp:$('#setting-whatsapp').value.trim()||null,email:$('#setting-email').value.trim()||null,gstin:$('#setting-gstin').value.trim()||null,currency:$('#setting-currency').value.trim().toUpperCase()||'INR',address:$('#setting-address').value.trim()||null,updated_at:new Date().toISOString()};var r=await client.from('business_settings').update(values).eq('id',lastSettings.id);if(r.error)throw r.error;toast('Business details saved.');await loadSettings();}
    catch(error){fail(error,'Business details could not be saved');}finally{setBusy(button,false);}
  }

  async function loadInvoice(id) {
    var result=await Promise.all([client.from('orders').select('*,customer:customers(full_name,customer_code,whatsapp_number,address,area)').eq('id',id).single(),client.from('order_items').select('id,item_name,quantity,unit,rate,amount,service:services(service_name)').eq('order_id',id).order('id'),client.from('business_settings').select('business_name,phone,whatsapp,address,email,gstin,currency').order('id').limit(1).maybeSingle()]);result.forEach(function(r){if(r.error)throw r.error;});
    var o=result[0].data,items=result[1].data||[],settings=result[2].data||{},customer=o.customer||{},balance=Math.max(Number(o.total_amount)-Number(o.paid_amount),0);
    var lines=items.map(function(item){return '<tr><td>'+esc(item.item_name||item.service&&item.service.service_name||'Laundry service')+'</td><td>'+Number(item.quantity||0)+' '+esc(item.unit||'')+'</td><td>'+money(item.rate)+'</td><td>'+money(item.amount)+'</td></tr>';}).join('');
    var html='<div class="invoice"><div class="invoice-top"><div class="invoice-brand">'+esc(settings.business_name||'CleanEazy Laundry')+'<small>FRESH CLOTHES. ZERO HASSLE.</small></div><div class="invoice-number"><b>INVOICE</b><span>'+esc(o.invoice_number||o.order_number)+'</span></div></div><div class="invoice-customer"><div><p>BILLED TO</p><strong>'+esc(customer.full_name||'Customer')+'</strong><br><small>'+esc(customer.customer_code||'')+' · '+esc(customer.whatsapp_number||'')+'</small><br><small>'+esc([customer.address,customer.area].filter(Boolean).join(', '))+'</small></div><div><p>ORDER</p><strong>'+esc(o.order_number)+'</strong><br><small>Order date · '+esc(displayDate(o.order_date))+'</small><br><small>Expected delivery · '+esc(displayDate(o.expected_delivery_date))+'</small></div></div><table class="invoice-table"><thead><tr><th>Service / item</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+lines+'</tbody></table><div class="invoice-totals"><div class="invoice-total-row"><span>Subtotal</span><strong>'+money(o.subtotal)+'</strong></div><div class="invoice-total-row"><span>Discount</span><strong>− '+money(o.discount)+'</strong></div><div class="invoice-total-row grand"><span>Grand total</span><strong>'+money(o.total_amount)+'</strong></div><div class="invoice-total-row"><span>Paid</span><strong>'+money(o.paid_amount)+'</strong></div><div class="invoice-total-row"><span>Outstanding</span><strong>'+money(balance)+'</strong></div><div class="invoice-total-row"><span>Payment status</span><strong>'+esc(o.payment_status)+'</strong></div></div><div class="invoice-foot">Thank you for choosing '+esc(settings.business_name||'CleanEazy Laundry')+'.<br>'+esc([settings.phone,settings.email].filter(Boolean).join(' · '))+'</div></div>';
    openDialog('Invoice '+(o.invoice_number||o.order_number),html,'<div class="invoice-actions"><button class="button button-outline" data-close>Close</button><button class="button button-green" data-print-invoice>Print / Save PDF</button></div>');
  }

  function downloadFile(name,content,type) { var blob=new Blob([content],{type:type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();window.setTimeout(function(){URL.revokeObjectURL(url);},1500); }

  document.addEventListener('DOMContentLoaded',start);
  window.addEventListener('unhandledrejection',function(event){console.error('Unhandled application promise:',event.reason);});
})();

