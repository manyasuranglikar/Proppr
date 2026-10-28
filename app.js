/**
 * Proppr Real Estate Lead Management Automation Engine
 * Interactive Simulator & Visualization Logic
 */

// Initial Sample Leads as specified in Task 2
const INITIAL_SAMPLE_LEADS = [
  {
    lead_id: 101,
    name: "Rahul Sharma",
    phone_number: "9876543210",
    location: "Gurgaon",
    budget: "₹1.5 Cr",
    source: "Website",
    enquiry_date: "2026-10-28 10:15:00"
  },
  {
    lead_id: 102,
    name: "Priya Mehta",
    phone_number: "9876543211",
    location: "Goa",
    budget: "₹90 Lakh",
    source: "WhatsApp",
    enquiry_date: "2026-10-28 11:30:00"
  },
  {
    lead_id: 103,
    name: "Rahul Sharma",
    phone_number: "9876543210",
    location: "Gurgaon",
    budget: "₹1.5 Cr",
    source: "Advertisement",
    enquiry_date: "2026-10-28 14:45:00"
  },
  {
    lead_id: 104,
    name: "Amit Verma",
    phone_number: "9876543212",
    location: "Gurgaon",
    budget: "₹2 Cr",
    source: "Website",
    enquiry_date: "2026-10-28 16:00:00"
  }
];

// Application State
let currentLeads = JSON.parse(JSON.stringify(INITIAL_SAMPLE_LEADS));
let processedCrmRecords = [];
let processedDuplicates = [];
let processedVipLeads = [];
let dispatchedAlerts = [];
let isCrmOffline = false;
let bufferedOfflineLeads = [];

// DOM Elements
const inboundLeadListEl = document.getElementById("inboundLeadList");
const btnRunPipeline = document.getElementById("btnRunPipeline");
const btnResetPipeline = document.getElementById("btnResetPipeline");
const customLeadForm = document.getElementById("customLeadForm");
const custPhoneInput = document.getElementById("custPhone");
const toggleCrmFailure = document.getElementById("toggleCrmFailure");
const toggleCrmLabel = document.getElementById("toggleCrmLabel");
const crmStatusBadge = document.getElementById("crmStatusBadge");
const bufferStatusBox = document.getElementById("bufferStatusBox");
const btnDrainQueue = document.getElementById("btnDrainQueue");
const stepperStatusText = document.getElementById("stepperStatusText");
const notificationsFeed = document.getElementById("notificationsFeed");
const n8nJsonPreview = document.getElementById("n8nJsonPreview");

// Metric Elements
const metricTotal = document.getElementById("metricTotal");
const metricUnique = document.getElementById("metricUnique");
const metricDuplicates = document.getElementById("metricDuplicates");
const metricPriority = document.getElementById("metricPriority");
const countCrm = document.getElementById("countCrm");
const countDup = document.getElementById("countDup");
const countVip = document.getElementById("countVip");
const countAlerts = document.getElementById("countAlerts");

// Table Bodies
const tableCrmBody = document.querySelector("#tableCrm tbody");
const tableDupBody = document.querySelector("#tableDup tbody");
const tableVipBody = document.querySelector("#tableVip tbody");

// Normalization & Parsing Utilities
function normalizePhone(raw) {
  if (!raw) return "";
  let digits = raw.toString().replace(/\D/g, "");
  // In India, mobile numbers are 10 digits.
  // Handles +91, 0, or international prefixes by extracting canonical trailing 10 digits
  if (digits.length >= 10) {
    digits = digits.slice(-10);
  }
  return digits;
}

function parseIndianBudget(str) {
  if (!str) return 0;
  if (typeof str === "number") return str;
  const text = str.toString().toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  if (text.includes("cr") || text.includes("crore")) return val * 10000000;
  if (text.includes("lakh") || text.includes("lac") || text.includes("l")) return val * 100000;
  return val;
}

function formatInrDisplay(amount) {
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${cr} Cr`;
  } else if (amount >= 100000) {
    const l = amount / 100000;
    return `₹${l} Lakh`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

// Render Inbound Lead Cards
function renderInboundList() {
  inboundLeadListEl.innerHTML = "";
  
  // Track seen phones in queue to highlight duplicates even before running
  const seenPhones = {};

  currentLeads.forEach(lead => {
    const norm = normalizePhone(lead.phone_number);
    const isDupInQueue = seenPhones[norm] !== undefined;
    seenPhones[norm] = true;

    const card = document.createElement("div");
    card.className = `inbound-lead-card ${isDupInQueue ? 'border-warning' : ''}`;
    card.innerHTML = `
      <div class="lead-header-row">
        <span class="lead-name">${lead.name} (#${lead.lead_id})</span>
        <div>
          ${isDupInQueue ? '<span class="badge badge-warning" style="margin-right: 4px;">Repeat Phone</span>' : ''}
          <span class="badge badge-source">${lead.source}</span>
        </div>
      </div>
      <div class="lead-meta-row">
        <span class="lead-phone">📞 ${lead.phone_number}</span>
        <span>📍 ${lead.location} • <strong>${lead.budget}</strong></span>
      </div>
    `;
    inboundLeadListEl.appendChild(card);
  });
  
  document.getElementById("queueCountBadge").textContent = `${currentLeads.length} Leads`;
  metricTotal.textContent = currentLeads.length;
}

// Switch to Duplicates sub-tab helper
function switchToDuplicatesTab() {
  document.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".sub-view").forEach(v => v.classList.remove("active"));
  
  const dupTabBtn = document.querySelector('.sub-tab[data-sub="view-dup"]');
  const dupView = document.getElementById("view-dup");
  if (dupTabBtn && dupView) {
    dupTabBtn.classList.add("active");
    dupView.classList.add("active");
  }
}

// Pipeline Processing Engine
async function runAutomationPipeline() {
  if (btnRunPipeline) {
    btnRunPipeline.disabled = true;
    btnRunPipeline.innerHTML = `<span>⏳ Processing Pipeline...</span>`;
  }

  // Reset output collections
  processedCrmRecords = [];
  processedDuplicates = [];
  processedVipLeads = [];
  dispatchedAlerts = [];
  bufferedOfflineLeads = [];

  const flowSteps = [
    document.getElementById("step1"),
    document.getElementById("step2"),
    document.getElementById("step3"),
    document.getElementById("step4"),
    document.getElementById("step5")
  ];

  function activateStep(idx, text) {
    flowSteps.forEach((s, i) => {
      if (s) {
        s.classList.remove("active");
        if (i < idx) s.classList.add("completed");
        else s.classList.remove("completed");
      }
    });
    if (flowSteps[idx]) flowSteps[idx].classList.add("active");
    if (stepperStatusText) stepperStatusText.textContent = text;
  }

  // Step 1: Intake & Normalization
  activateStep(0, "Stage 1/5: Normalizing phone numbers & parsing Indian currency units...");
  await delay(400);

  // Step 2: Buffer to Google Sheets
  activateStep(1, "Stage 2/5: Appending raw payloads to 'Raw_Ingestion_Audit' Google Sheet...");
  await delay(400);

  // Deduplication lookup map: phone -> master record
  const phoneToRecordMap = {};

  for (let i = 0; i < currentLeads.length; i++) {
    const lead = currentLeads[i];
    const normPhone = normalizePhone(lead.phone_number);
    const budgetInr = parseIndianBudget(lead.budget);
    const isGurgaon = lead.location.trim().toLowerCase() === "gurgaon";
    const isPriority = isGurgaon && budgetInr >= 15000000;

    // Deduplication check using unique normalized phone number
    if (phoneToRecordMap[normPhone] !== undefined) {
      // DUPLICATE DETECTED!
      const masterRecord = phoneToRecordMap[normPhone];
      
      activateStep(2, `Stage 3/5: Duplicate intercepted! Phone '${normPhone}' on Lead #${lead.lead_id} matched to Master Lead #${masterRecord.lead_id}`);

      // Merge touchpoint onto master contact
      if (!masterRecord.touchpoint_sources.includes(lead.source)) {
        masterRecord.touchpoint_sources.push(lead.source);
      }
      masterRecord.touchpoint_count += 1;
      masterRecord.enquiry_history.push({
        lead_id: lead.lead_id,
        source: lead.source,
        budget: lead.budget,
        date: lead.enquiry_date
      });

      // Record duplicate entry in audit log
      const dupRecord = {
        duplicate_lead_id: lead.lead_id,
        master_lead_id: masterRecord.lead_id,
        name: lead.name,
        phone_number: normPhone,
        new_source: lead.source,
        location: lead.location,
        budget_raw: lead.budget,
        reason: `Phone '${normPhone}' already registered to Lead #${masterRecord.lead_id} (${masterRecord.name})`,
        action: `Appended touchpoint note; no duplicate contact created in CRM`
      };
      processedDuplicates.push(dupRecord);

      // Notification
      dispatchedAlerts.push({
        type: "dup",
        icon: "🔄",
        title: `Repeat Enquiry Touchpoint: ${lead.name} (${normPhone})`,
        time: "Just now",
        body: `Prospect enquired via <strong>${lead.source}</strong> for ${lead.location} (${lead.budget}). Timeline activity appended to existing CRM record #${masterRecord.lead_id}. Assigned advisor alerted.`
      });

    } else {
      // FIRST TIME SEEING THIS PHONE: Unique Master Contact
      let assignedDesk = "General Sales Desk";
      if (isGurgaon) {
        assignedDesk = isPriority ? "Gurgaon Senior Advisory Team" : "Gurgaon Residential Desk";
      } else if (lead.location.trim().toLowerCase() === "goa") {
        assignedDesk = "Goa Holiday & Luxury Advisory Desk";
      }

      const masterRecord = {
        lead_id: lead.lead_id,
        name: lead.name,
        phone_number: normPhone,
        location: lead.location,
        budget_raw: lead.budget,
        budget_inr: budgetInr,
        primary_source: lead.source,
        touchpoint_sources: [lead.source],
        touchpoint_count: 1,
        enquiry_date: lead.enquiry_date,
        is_priority: isPriority,
        priority_label: isPriority ? "HIGH PRIORITY (Gurgaon >= ₹1.5 Cr)" : "STANDARD",
        follow_up_status: "New",
        assigned_team: assignedDesk,
        enquiry_history: [{
          lead_id: lead.lead_id,
          source: lead.source,
          budget: lead.budget,
          date: lead.enquiry_date
        }]
      };

      phoneToRecordMap[normPhone] = masterRecord;

      if (isCrmOffline) {
        bufferedOfflineLeads.push(masterRecord);
      } else {
        processedCrmRecords.push(masterRecord);
      }

      if (isPriority) {
        processedVipLeads.push(masterRecord);
        dispatchedAlerts.push({
          type: "vip",
          icon: "🚨",
          title: `HIGH-PRIORITY LEAD: ${lead.name} (${lead.budget})`,
          time: "Just now",
          body: `Gurgaon luxury lead &ge; ₹1.5 Cr received from <strong>${lead.source}</strong>. Routed to <strong>${assignedDesk}</strong> with 15-minute response SLA.`
        });
      } else {
        dispatchedAlerts.push({
          type: "std",
          icon: "📋",
          title: `New Lead Ingested: ${lead.name} (${lead.location})`,
          time: "Just now",
          body: `Budget: ${lead.budget} via <strong>${lead.source}</strong>. Routed to <strong>${assignedDesk}</strong> with status 'New'.`
        });
      }
    }
  }

  // Step 4: Priority & Routing Highlight
  activateStep(3, "Stage 4/5: Evaluating priority rules (Gurgaon >= ₹1.5 Cr) and team routing...");
  await delay(400);

  // Step 5: CRM Sync & Notifications
  if (isCrmOffline) {
    activateStep(4, "Stage 5/5: CRM OFFLINE! Circuit breaker tripped: Leads buffered in Google Sheets DLQ.");
    dispatchedAlerts.unshift({
      type: "vip",
      icon: "⚠️",
      title: "CIRCUIT BREAKER: CRM Service Unreachable",
      time: "Just now",
      body: `HubSpot / CRM returned HTTP 503. ${bufferedOfflineLeads.length} leads safely persisted to Google Sheets Staging Buffer. Auto-retry scheduled.`
    });
    if (bufferStatusBox) bufferStatusBox.style.display = "flex";
  } else {
    activateStep(4, `Stage 5/5: CRM sync complete! ${processedCrmRecords.length} contacts synced, ${processedDuplicates.length} duplicates intercepted.`);
  }

  flowSteps.forEach(s => { if (s) s.classList.add("completed"); });
  await delay(300);

  // Update UI and Tables
  renderTables();
  renderAlerts();
  updateMetrics();

  if (btnRunPipeline) {
    btnRunPipeline.disabled = false;
    btnRunPipeline.innerHTML = `<span>▶ Run Full Automation Pipeline</span>`;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Render Output Tables
function renderTables() {
  // Table 1: Cleaned CRM Records
  tableCrmBody.innerHTML = "";
  
  // Show or update the duplicate intercept alert banner above the CRM table
  let dupBanner = document.getElementById("crmDuplicateAlertBanner");
  if (!dupBanner) {
    dupBanner = document.createElement("div");
    dupBanner.id = "crmDuplicateAlertBanner";
    dupBanner.className = "alert-banner mb-3";
    const crmContainer = document.querySelector("#view-crm .table-responsive");
    if (crmContainer && crmContainer.parentNode) {
      crmContainer.parentNode.insertBefore(dupBanner, crmContainer);
    }
  }

  if (processedDuplicates.length > 0) {
    dupBanner.style.display = "flex";
    dupBanner.style.justifyContent = "space-between";
    dupBanner.style.alignItems = "center";
    dupBanner.innerHTML = `
      <div>
        <strong>🔄 ${processedDuplicates.length} Duplicate Enquiry Intercepted & Merged:</strong>
        <span>Repeat submissions with the same phone numbers were merged into existing CRM profiles. No duplicate contacts created!</span>
      </div>
      <button class="btn btn-sm btn-outline" style="white-space: nowrap; margin-left: 1rem;" onclick="switchToDuplicatesTab()">View Duplicate Log ➔</button>
    `;
  } else {
    dupBanner.style.display = "none";
  }

  if (processedCrmRecords.length === 0) {
    tableCrmBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">${isCrmOffline ? 'CRM is offline — leads buffered in Google Sheet Staging Buffer' : 'No CRM records processed yet. Click "Run Full Automation Pipeline" above.'}</td></tr>`;
  } else {
    processedCrmRecords.forEach(rec => {
      const tr = document.createElement("tr");
      tr.className = rec.is_priority ? "highlight-row" : "";
      
      const sourcesBadge = rec.touchpoint_sources.map(s => `<span class="badge badge-source">${s}</span>`).join(" ");
      const pBadge = rec.is_priority 
        ? `<span class="badge badge-danger">🔥 HIGH PRIORITY</span>` 
        : `<span class="badge badge-info">Standard</span>`;

      const dupBadge = rec.touchpoint_count > 1 
        ? `<div style="margin-top: 4px;"><span class="badge badge-warning" style="cursor: pointer;" onclick="switchToDuplicatesTab()" title="Click to view in Duplicate Log">🔄 ${rec.touchpoint_count - 1} Duplicate(s) Merged</span></div>` 
        : '';

      tr.innerHTML = `
        <td><strong>#${rec.lead_id}</strong></td>
        <td><strong>${rec.name}</strong></td>
        <td><code>${rec.phone_number}</code></td>
        <td>${rec.location}</td>
        <td><strong>${rec.budget_raw}</strong> <span class="text-muted text-sm">(₹${(rec.budget_inr/10000000).toFixed(2)} Cr)</span></td>
        <td>
          ${sourcesBadge} <small class="text-muted">(${rec.touchpoint_count} touchpoint${rec.touchpoint_count > 1 ? 's' : ''})</small>
          ${dupBadge}
        </td>
        <td>${pBadge}</td>
        <td><span class="badge badge-success">${rec.follow_up_status}</span></td>
        <td><small>${rec.assigned_team}</small></td>
      `;
      tableCrmBody.appendChild(tr);
    });
  }

  // Table 2: Duplicate Enquiries Log
  tableDupBody.innerHTML = "";
  if (processedDuplicates.length === 0) {
    tableDupBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No duplicate enquiries detected. Add two leads with the same phone number to test duplicate interception!</td></tr>`;
  } else {
    processedDuplicates.forEach(dup => {
      const tr = document.createElement("tr");
      tr.className = "highlight-row-warning";
      tr.innerHTML = `
        <td><strong>#${dup.duplicate_lead_id}</strong></td>
        <td><span class="badge badge-warning">Matched to #${dup.master_lead_id}</span></td>
        <td><strong>${dup.name}</strong></td>
        <td><code>${dup.phone_number}</code></td>
        <td><span class="badge badge-source">${dup.new_source}</span></td>
        <td>${dup.location}</td>
        <td><small class="text-warning"><strong>${dup.reason}</strong></small></td>
        <td><small class="text-success">${dup.action}</small></td>
      `;
      tableDupBody.appendChild(tr);
    });
  }

  // Table 3: VIP Leads
  tableVipBody.innerHTML = "";
  if (processedVipLeads.length === 0) {
    tableVipBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No high-priority leads matched yet</td></tr>`;
  } else {
    processedVipLeads.forEach(vip => {
      const tr = document.createElement("tr");
      tr.className = "highlight-row";
      tr.innerHTML = `
        <td><strong>#${vip.lead_id}</strong></td>
        <td><strong>${vip.name}</strong></td>
        <td><code>${vip.phone_number}</code></td>
        <td>${vip.location}</td>
        <td><strong class="text-vip">${vip.budget_raw}</strong></td>
        <td><span class="badge badge-source">${vip.primary_source}</span></td>
        <td><span class="vip-badge">15 MIN SLA</span></td>
        <td><strong>${vip.assigned_team}</strong></td>
      `;
      tableVipBody.appendChild(tr);
    });
  }
}

// Render Alerts Feed
function renderAlerts() {
  notificationsFeed.innerHTML = "";
  if (dispatchedAlerts.length === 0) {
    notificationsFeed.innerHTML = `<div class="text-center text-muted py-4">No notifications dispatched yet</div>`;
    return;
  }
  dispatchedAlerts.forEach(alert => {
    const item = document.createElement("div");
    item.className = `notification-item ${alert.type}`;
    item.innerHTML = `
      <div class="notif-icon">${alert.icon}</div>
      <div class="notif-content">
        <div class="notif-header">
          <span class="notif-title">${alert.title}</span>
          <span class="notif-time">${alert.time}</span>
        </div>
        <div class="notif-body">${alert.body}</div>
      </div>
    `;
    notificationsFeed.appendChild(item);
  });
}

// Update Metrics Counters
function updateMetrics() {
  metricUnique.textContent = processedCrmRecords.length + (isCrmOffline ? bufferedOfflineLeads.length : 0);
  metricDuplicates.textContent = processedDuplicates.length;
  metricPriority.textContent = processedVipLeads.length;

  countCrm.textContent = processedCrmRecords.length;
  countDup.textContent = processedDuplicates.length;
  countVip.textContent = processedVipLeads.length;
  countAlerts.textContent = dispatchedAlerts.length;
}

// Reset Pipeline Function
function resetPipeline() {
  currentLeads = JSON.parse(JSON.stringify(INITIAL_SAMPLE_LEADS));
  processedCrmRecords = [];
  processedDuplicates = [];
  processedVipLeads = [];
  dispatchedAlerts = [];
  bufferedOfflineLeads = [];
  document.querySelectorAll(".flow-step").forEach(s => {
    if (s) s.classList.remove("active", "completed");
  });
  if (stepperStatusText) stepperStatusText.textContent = "Ready to process";
  renderInboundList();
  renderTables();
  renderAlerts();
  updateMetrics();
}

// Register Listeners
if (btnRunPipeline) {
  btnRunPipeline.addEventListener("click", runAutomationPipeline);
}

if (btnResetPipeline) {
  btnResetPipeline.addEventListener("click", resetPipeline);
}

// Sub Tab Switching (CRM / Dups / VIP / Alerts)
document.querySelectorAll(".sub-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".sub-view").forEach(v => v.classList.remove("active"));
    tab.classList.add("active");
    const targetId = tab.getAttribute("data-sub");
    const targetView = document.getElementById(targetId);
    if (targetView) targetView.classList.add("active");
  });
});

// Main Nav Tab Switching
document.querySelectorAll(".nav-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    const targetId = tab.getAttribute("data-tab");
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add("active");
    window.scrollTo({ top: 400, behavior: "smooth" });
  });
});

// Header Docs button
const btnViewDocs = document.getElementById("btnViewDocs");
if (btnViewDocs) {
  btnViewDocs.addEventListener("click", () => {
    const taskTab = document.querySelector(".nav-tab[data-tab='tab-workflow']");
    if (taskTab) taskTab.click();
  });
}

// Live duplicate detection indicator on typing phone in form
if (custPhoneInput) {
  let hintEl = document.getElementById("phoneDupHint");
  if (!hintEl) {
    hintEl = document.createElement("small");
    hintEl.id = "phoneDupHint";
    hintEl.style.display = "none";
    hintEl.style.color = "#f59e0b";
    hintEl.style.fontWeight = "600";
    hintEl.style.marginTop = "4px";
    hintEl.style.display = "none";
    custPhoneInput.parentNode.appendChild(hintEl);
  }

  custPhoneInput.addEventListener("input", (e) => {
    const norm = normalizePhone(e.target.value);
    if (norm.length >= 10) {
      const match = currentLeads.find(l => normalizePhone(l.phone_number) === norm);
      if (match) {
        hintEl.style.display = "block";
        hintEl.innerHTML = `⚠️ Matches existing lead <strong>#${match.lead_id} (${match.name})</strong>! Submitting this will test duplicate interception.`;
      } else {
        hintEl.style.display = "none";
      }
    } else {
      hintEl.style.display = "none";
    }
  });
}

// Custom Lead Form Ingestion
if (customLeadForm) {
  customLeadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("custName").value.trim();
    const phone = document.getElementById("custPhone").value.trim();
    const location = document.getElementById("custLocation").value;
    const budget = document.getElementById("custBudget").value.trim();
    const source = document.getElementById("custSource").value;

    const norm = normalizePhone(phone);
    const existingMatch = currentLeads.find(l => normalizePhone(l.phone_number) === norm);

    const newId = 100 + currentLeads.length + 1;
    const newLead = {
      lead_id: newId,
      name: name,
      phone_number: phone,
      location: location,
      budget: budget,
      source: source,
      enquiry_date: new Date().toISOString().replace("T", " ").substring(0, 19)
    };

    currentLeads.push(newLead);
    renderInboundList();
    customLeadForm.reset();

    const hintEl = document.getElementById("phoneDupHint");
    if (hintEl) hintEl.style.display = "none";

    // Auto run pipeline so user immediately sees duplicate detection in action!
    runAutomationPipeline();
  });
}

// Toggle CRM Downtime
if (toggleCrmFailure) {
  toggleCrmFailure.addEventListener("change", (e) => {
    isCrmOffline = e.target.checked;
    if (isCrmOffline) {
      crmStatusBadge.textContent = "CRM Offline (503)";
      crmStatusBadge.className = "badge badge-danger";
      toggleCrmLabel.textContent = "CRM Offline — Safe Buffer Active";
      toggleCrmLabel.style.color = "var(--accent-rose)";
    } else {
      crmStatusBadge.textContent = "CRM Online";
      crmStatusBadge.className = "badge badge-warning";
      toggleCrmLabel.textContent = "Simulate CRM Downtime (Offline)";
      toggleCrmLabel.style.color = "var(--text-main)";
      if (bufferStatusBox) bufferStatusBox.style.display = "none";
    }
  });
}

// Replay Buffered Leads
if (btnDrainQueue) {
  btnDrainQueue.addEventListener("click", () => {
    if (isCrmOffline) {
      alert("Please uncheck 'Simulate CRM Downtime' first so CRM is online before replaying!");
      return;
    }
    if (bufferedOfflineLeads.length === 0) {
      alert("No buffered leads to drain.");
      return;
    }
    processedCrmRecords.push(...bufferedOfflineLeads);
    const count = bufferedOfflineLeads.length;
    bufferedOfflineLeads = [];
    if (bufferStatusBox) bufferStatusBox.style.display = "none";
    renderTables();
    updateMetrics();
    alert(`Self-heal success! All ${count} buffered leads have been successfully replayed and synced to CRM Contacts with zero duplicates.`);
  });
}

// Export JSON
const btnExportJson = document.getElementById("btnExportJson");
if (btnExportJson) {
  btnExportJson.addEventListener("click", () => {
    const exportPayload = {
      summary: {
        total_inbound: currentLeads.length,
        crm_unique_contacts: processedCrmRecords.length,
        duplicate_enquiries: processedDuplicates.length,
        high_priority_vip: processedVipLeads.length
      },
      cleaned_crm_records: processedCrmRecords,
      duplicate_audit_log: processedDuplicates,
      vip_leads: processedVipLeads
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "proppr_processed_leads.json");
    dlAnchor.click();
  });
}

// Load n8n JSON preview into viewer
async function loadN8nBlueprint() {
  if (!n8nJsonPreview) return;
  try {
    const res = await fetch("workflows/n8n_proppr_lead_workflow.json");
    if (res.ok) {
      const data = await res.json();
      n8nJsonPreview.textContent = JSON.stringify(data, null, 2).substring(0, 2500) + "\n\n... (Full workflow blueprint available in workflows/n8n_proppr_lead_workflow.json)";
    }
  } catch (err) {
    n8nJsonPreview.textContent = "// n8n workflow blueprint located at workflows/n8n_proppr_lead_workflow.json";
  }
}

// Make functions globally accessible for inline onclicks
window.runAutomationPipeline = runAutomationPipeline;
window.resetPipeline = resetPipeline;
window.switchToDuplicatesTab = switchToDuplicatesTab;

// Initial Boot
renderInboundList();
loadN8nBlueprint();
