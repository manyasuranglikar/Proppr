"""
Proppr Real Estate Advisory - Lead Management Automation Logic
Task 3 Option B: Lead Deduplication, Priority Flagging & Cleansing Pipeline
Author: Antigravity AI
"""

import re
import json
import sys
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime, timezone

# Ensure UTF-8 output in Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Sample Data as provided in the assignment
SAMPLE_LEADS: List[Dict[str, Any]] = [
    {
        "lead_id": 101,
        "name": "Rahul Sharma",
        "phone_number": "9876543210",
        "location": "Gurgaon",
        "budget": "₹1.5 Cr",
        "source": "Website",
        "enquiry_date": "2026-10-28 10:15:00"
    },
    {
        "lead_id": 102,
        "name": "Priya Mehta",
        "phone_number": "9876543211",
        "location": "Goa",
        "budget": "₹90 Lakh",
        "source": "WhatsApp",
        "enquiry_date": "2026-10-28 11:30:00"
    },
    {
        "lead_id": 103,
        "name": "Rahul Sharma",
        "phone_number": "9876543210",
        "location": "Gurgaon",
        "budget": "₹1.5 Cr",
        "source": "Advertisement",
        "enquiry_date": "2026-10-28 14:45:00"
    },
    {
        "lead_id": 104,
        "name": "Amit Verma",
        "phone_number": "9876543212",
        "location": "Gurgaon",
        "budget": "₹2 Cr",
        "source": "Website",
        "enquiry_date": "2026-10-28 16:00:00"
    }
]


def normalize_phone(phone_raw: Any) -> str:
    """
    Standardize Indian phone numbers into canonical 10-digit format.
    Handles '+91', leading '0', spaces, hyphens, and brackets.
    """
    if not phone_raw:
        return ""
    # Remove all non-digit characters
    digits = re.sub(r"\D", "", str(phone_raw))
    # If prefixed with 91 and length is 12 digits, strip country code
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    # If prefixed with 0 and length is 11 digits, strip leading 0
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


def parse_indian_budget(budget_str: Any) -> float:
    """
    Parses Indian real estate budget strings (e.g., '₹1.5 Cr', '₹90 Lakh')
    into numerical INR values for deterministic comparison.
    
    1 Crore = 1,00,00,000 (10^7)
    1 Lakh  = 1,00,000    (10^5)
    """
    if isinstance(budget_str, (int, float)):
        return float(budget_str)
    
    text = str(budget_str).strip().lower()
    
    # Extract numeric component (integer or decimal)
    num_match = re.search(r"(\d+(?:\.\d+)?)", text)
    if not num_match:
        return 0.0
    
    value = float(num_match.group(1))
    
    if "cr" in text or "crore" in text:
        return value * 10_000_000
    elif "lakh" in text or "lac" in text or "l" in text:
        return value * 100_000
    else:
        # Fallback if raw number string without unit
        return value


def evaluate_priority(location: str, budget_inr: float) -> Tuple[bool, str]:
    """
    Evaluates whether a lead qualifies for high priority follow-up:
    Criteria: Budget >= ₹1.5 Cr (15,000,000 INR) AND Location is 'Gurgaon'.
    """
    is_gurgaon = location.strip().lower() == "gurgaon"
    meets_budget = budget_inr >= 15_000_000
    
    if is_gurgaon and meets_budget:
        return True, "HIGH PRIORITY (Gurgaon >= ₹1.5 Cr)"
    elif is_gurgaon:
        return False, "STANDARD (Gurgaon)"
    elif location.strip().lower() == "goa":
        return False, "STANDARD (Goa Luxury Advisory)"
    return False, "STANDARD"


def assign_advisory_team(location: str, is_priority: bool) -> str:
    """
    Routes leads to appropriate operational desks.
    """
    loc = location.strip().lower()
    if loc == "gurgaon":
        return "Gurgaon Senior Advisory Team" if is_priority else "Gurgaon Residential Desk"
    elif loc == "goa":
        return "Goa Holiday & Luxury Advisory Desk"
    return "General Sales Desk"


def process_leads(leads: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Main lead processing pipeline:
    1. Validates and normalizes phone numbers.
    2. Identifies unique vs duplicate leads using phone number as unique identifier.
    3. Merges multi-channel touchpoints on duplicate leads.
    4. Evaluates priority criteria (Gurgaon >= ₹1.5 Cr).
    5. Assigns follow-up status and team routing.
    """
    cleaned_leads: List[Dict[str, Any]] = []
    duplicate_leads: List[Dict[str, Any]] = []
    
    # Phone number map to track master contacts
    phone_to_lead_index: Dict[str, int] = {}
    
    for raw_lead in leads:
        lead_id = raw_lead.get("lead_id")
        name = raw_lead.get("name", "").strip().title()
        raw_phone = raw_lead.get("phone_number")
        norm_phone = normalize_phone(raw_phone)
        location = raw_lead.get("location", "").strip()
        raw_budget = raw_lead.get("budget", "")
        budget_inr = parse_indian_budget(raw_budget)
        source = raw_lead.get("source", "Unknown")
        enquiry_date = raw_lead.get("enquiry_date", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))
        
        is_priority, priority_tag = evaluate_priority(location, budget_inr)
        assigned_team = assign_advisory_team(location, is_priority)
        
        # Check for duplication based on unique phone number
        if norm_phone in phone_to_lead_index:
            # Duplicate detected!
            primary_index = phone_to_lead_index[norm_phone]
            primary_lead = cleaned_leads[primary_index]
            
            # Record duplicate audit entry
            dup_record = {
                "duplicate_lead_id": lead_id,
                "master_lead_id": primary_lead["lead_id"],
                "name": name,
                "phone_number": norm_phone,
                "location": location,
                "budget_raw": raw_budget,
                "budget_inr": budget_inr,
                "source": source,
                "enquiry_date": enquiry_date,
                "flag_reason": f"Phone number '{norm_phone}' already registered to Lead #{primary_lead['lead_id']} ({primary_lead['name']})",
                "recommended_crm_action": "APPEND_TOUCHPOINT_DO_NOT_CREATE_NEW_CONTACT"
            }
            duplicate_leads.append(dup_record)
            
            # Enrich master lead with multi-channel touchpoint metadata
            if source not in primary_lead["touchpoint_sources"]:
                primary_lead["touchpoint_sources"].append(source)
            primary_lead["touchpoint_count"] += 1
            primary_lead["enquiry_history"].append({
                "lead_id": lead_id,
                "source": source,
                "date": enquiry_date,
                "budget": raw_budget
            })
            primary_lead["last_enquiry_date"] = enquiry_date
            
        else:
            # First time seeing this phone number: Primary Master Lead
            master_lead = {
                "lead_id": lead_id,
                "name": name,
                "phone_number": norm_phone,
                "location": location,
                "budget_raw": raw_budget,
                "budget_inr": budget_inr,
                "primary_source": source,
                "touchpoint_sources": [source],
                "touchpoint_count": 1,
                "first_enquiry_date": enquiry_date,
                "last_enquiry_date": enquiry_date,
                "follow_up_status": "New",
                "is_priority": is_priority,
                "priority_label": priority_tag,
                "assigned_team": assigned_team,
                "enquiry_history": [
                    {
                        "lead_id": lead_id,
                        "source": source,
                        "date": enquiry_date,
                        "budget": raw_budget
                    }
                ]
            }
            
            phone_to_lead_index[norm_phone] = len(cleaned_leads)
            cleaned_leads.append(master_lead)
            
    return {
        "summary": {
            "total_raw_leads": len(leads),
            "unique_master_leads": len(cleaned_leads),
            "duplicate_enquiries": len(duplicate_leads),
            "high_priority_leads": sum(1 for l in cleaned_leads if l["is_priority"])
        },
        "cleaned_leads": cleaned_leads,
        "duplicate_leads": duplicate_leads
    }


def format_currency_inr(amount: float) -> str:
    """Format numerical INR back to standard Indian Cr/Lakh display."""
    if amount >= 10_000_000:
        cr = amount / 10_000_000
        return f"₹{cr:.2f}".rstrip("0").rstrip(".") + " Cr"
    elif amount >= 100_000:
        lakh = amount / 100_000
        return f"₹{lakh:.2f}".rstrip("0").rstrip(".") + " Lakh"
    return f"₹{amount:,.0f}"


def print_report(results: Dict[str, Any]) -> None:
    """Print an executive summary to console."""
    summary = results["summary"]
    print("=" * 80)
    print(" PROPPR REAL ESTATE ADVISORY - LEAD AUTOMATION REPORT ")
    print("=" * 80)
    print(f"Total Ingested Leads : {summary['total_raw_leads']}")
    print(f"Unique Master Leads  : {summary['unique_master_leads']}")
    print(f"Duplicate Enquiries  : {summary['duplicate_enquiries']}")
    print(f"High-Priority Leads  : {summary['high_priority_leads']}")
    print("-" * 80)
    
    print("\n[+] MASTER CLEANED CRM RECORDS (Unique Contacts to Sync):")
    print(f"{'ID':<6} {'Name':<16} {'Phone':<12} {'Location':<10} {'Budget':<12} {'Priority':<22} {'Team Assigned':<28}")
    print("-" * 110)
    for lead in results["cleaned_leads"]:
        p_str = "[PRIORITY]" if lead["is_priority"] else "[STANDARD]"
        print(f"{lead['lead_id']:<6} {lead['name']:<16} {lead['phone_number']:<12} {lead['location']:<10} {lead['budget_raw']:<12} {p_str + ' ' + lead['priority_label'][:12]:<22} {lead['assigned_team']:<28}")
        if lead["touchpoint_count"] > 1:
            sources_str = ", ".join(lead["touchpoint_sources"])
            print(f"       └─ Multi-Touch Lead! {lead['touchpoint_count']} enquiries from sources: [{sources_str}]")
            
    print("\n[+] DUPLICATE ENQUIRIES LOG (Appended to existing contacts, not duplicate CRM records):")
    print(f"{'Dup ID':<8} {'Master ID':<10} {'Name':<16} {'Phone':<12} {'New Source':<15} {'Flag Reason':<35}")
    print("-" * 100)
    for dup in results["duplicate_leads"]:
        print(f"{dup['duplicate_lead_id']:<8} #{dup['master_lead_id']:<9} {dup['name']:<16} {dup['phone_number']:<12} {dup['source']:<15} {dup['flag_reason'][:35]}")
    print("=" * 80)


def run_tests() -> None:
    """Verification unit tests for edge cases."""
    print("Running validation tests...")
    
    # Test phone normalization
    assert normalize_phone("+919876543210") == "9876543210"
    assert normalize_phone("09876543210") == "9876543210"
    assert normalize_phone("98765-43210") == "9876543210"
    assert normalize_phone(" 98765 43210 ") == "9876543210"
    
    # Test budget parsing
    assert parse_indian_budget("₹1.5 Cr") == 15_000_000.0
    assert parse_indian_budget("₹90 Lakh") == 9_000_000.0
    assert parse_indian_budget("₹2 Cr") == 20_000_000.0
    assert parse_indian_budget("₹1.75 Crore") == 17_500_000.0
    assert parse_indian_budget("₹50 Lacs") == 5_000_000.0
    
    # Test priority evaluation
    is_p, _ = evaluate_priority("Gurgaon", 15_000_000.0)
    assert is_p is True
    is_p, _ = evaluate_priority("Gurgaon", 20_000_000.0)
    assert is_p is True
    is_p, _ = evaluate_priority("Gurgaon", 9_000_000.0)
    assert is_p is False
    is_p, _ = evaluate_priority("Goa", 20_000_000.0)
    assert is_p is False
    
    # Test sample leads processing
    res = process_leads(SAMPLE_LEADS)
    assert res["summary"]["total_raw_leads"] == 4
    assert res["summary"]["unique_master_leads"] == 3
    assert res["summary"]["duplicate_enquiries"] == 1
    assert res["summary"]["high_priority_leads"] == 2
    
    # Verify Rahul Sharma deduplication
    rahul = next(l for l in res["cleaned_leads"] if l["phone_number"] == "9876543210")
    assert rahul["touchpoint_count"] == 2
    assert "Website" in rahul["touchpoint_sources"]
    assert "Advertisement" in rahul["touchpoint_sources"]
    assert rahul["is_priority"] is True
    
    # Verify Amit Verma priority
    amit = next(l for l in res["cleaned_leads"] if l["phone_number"] == "9876543212")
    assert amit["is_priority"] is True
    assert amit["budget_inr"] == 20_000_000.0
    
    # Verify Priya Mehta priority
    priya = next(l for l in res["cleaned_leads"] if l["phone_number"] == "9876543211")
    assert priya["is_priority"] is False
    assert priya["location"] == "Goa"
    
    print("All tests passed successfully!\n")


if __name__ == "__main__":
    run_tests()
    results = process_leads(SAMPLE_LEADS)
    print_report(results)
    
    # Save output artifacts
    with open("scripts/cleaned_leads.json", "w", encoding="utf-8") as f:
        json.dump(results["cleaned_leads"], f, indent=2, ensure_ascii=False)
        
    with open("scripts/duplicate_leads.json", "w", encoding="utf-8") as f:
        json.dump(results["duplicate_leads"], f, indent=2, ensure_ascii=False)
        
    print("\n[+] Cleaned leads exported to 'scripts/cleaned_leads.json'")
    print("[+] Duplicate audit log exported to 'scripts/duplicate_leads.json'")
