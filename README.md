# Proppr Real Estate Advisory — Lead Management Automation Assignment

[![Status](https://img.shields.io/badge/Status-Complete-emerald)](#)
[![Python](https://img.shields.io/badge/Python-3.13-blue)](scripts/lead_processor.py)
[![n8n Blueprint](https://img.shields.io/badge/n8n-Workflow_Blueprint-orange)](workflows/n8n_proppr_lead_workflow.json)
[![Interactive Simulator](https://img.shields.io/badge/Interactive-Web_Simulator-indigo)](index.html)

This repository contains the complete assignment submission for **Proppr's Real Estate Lead Management Automation System** operating in the **Gurgaon** and **Goa** luxury advisory markets.

---

## 🚀 Quick Start & Interactive Demo

### Option 1: Launch the Interactive Web Simulator
Open `index.html` in your browser (or visit `http://localhost:8000` if the server is running):
- **Live Pipeline Visualizer:** Click *"Run Full Automation Pipeline"* to watch all 4 sample leads flow through the 5 automation stages.
- **Duplicate Interception:** Inspect how Lead 103 (Rahul Sharma via Advertisement) is matched to Lead 101 (Rahul Sharma via Website) and appended as a touchpoint without creating a duplicate CRM contact.
- **VIP Routing:** Observe automatic priority flagging and 15-minute SLA dispatch for Gurgaon leads &ge; ₹1.5 Cr (Amit Verma & Rahul Sharma).
- **Circuit Breaker Simulator:** Toggle *"Simulate CRM Downtime"* to test zero-loss buffering into Google Sheets and self-healing replay.
- **Custom Lead Ingestion:** Test any custom prospect name, location, and budget (e.g. ₹2.5 Cr) in real time.

### Option 2: Run the Python Pipeline Script
```bash
python scripts/lead_processor.py
```
This script executes:
1. Built-in test suite (phone normalization, Indian Cr/Lakh budget parsing, priority rules).
2. Lead deduplication and multi-touch tracking.
3. Clean exports to `scripts/cleaned_leads.json` and `scripts/duplicate_leads.json`.

---

## 📁 Repository Structure

```
├── index.html                           # Interactive web simulator dashboard
├── style.css                            # Modern styling system & design tokens
├── app.js                               # Interactive pipeline simulation engine
├── SUBMISSION.md                        # Master comprehensive submission report
├── README.md                            # Repository overview & quick start
├── scripts/
│   ├── lead_processor.py               # Task 3 Option B: Python processor & unit tests
│   ├── cleaned_leads.json              # Processed master CRM contacts (101, 102, 104)
│   └── duplicate_leads.json            # Duplicate enquiry audit log (103 matched to 101)
└── workflows/
    └── n8n_proppr_lead_workflow.json   # Task 3 Option A: Importable n8n workflow blueprint
```

---

## 📑 Complete Assignment Report
For the complete technical write-up, Mermaid sequence diagrams, detailed answers to Task 2 questions, and non-technical operational documentation, please refer to [SUBMISSION.md](SUBMISSION.md).
