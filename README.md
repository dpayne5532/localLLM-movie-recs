# Local LLM Processing Platform
## Proof of Concept | Catalyst Solutions

**Secure, On-Premises AI Processing with Zero Cloud Exposure**

---

## Executive Summary

This proof of concept demonstrates a fully local AI processing platform where **sensitive data never leaves the organization's infrastructure**. Using a movie recommendation system as a stand-in for healthcare claims processing, we've built an end-to-end pipeline that:

- Processes unstructured text inputs using a local Large Language Model (LLM)
- Enriches AI responses with organizational knowledge through Retrieval Augmented Generation (RAG)
- Exposes only a secure SFTP gateway to external systems—**no PHI touches the internet**
- Runs entirely on commodity hardware (Apple Mac Mini)

**For healthcare applications**, this architecture enables AI-powered claims adjudication, prior authorization, and clinical decision support while maintaining full HIPAA compliance and data sovereignty.

---

## Why Local LLM?

### The Cloud AI Problem

Traditional cloud-based AI services (OpenAI, Azure AI, AWS Bedrock, Google Vertex) require sending data to third-party servers. For healthcare organizations, this creates significant challenges:

| Challenge | Cloud AI Risk | Local LLM Solution |
|-----------|---------------|-------------------|
| **PHI Exposure** | Patient data transmitted to third parties | Data never leaves your premises |
| **BAA Complexity** | Requires Business Associate Agreements with AI vendors | No external vendors process PHI |
| **Compliance Burden** | Must audit vendor security practices | Full control over security posture |
| **Data Residency** | Data may be processed in unknown locations | Data stays in your data center |
| **Cost Predictability** | Per-token pricing scales unpredictably | Fixed infrastructure cost |

### The Catalyst Solutions Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         YOUR INFRASTRUCTURE                                  │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   External  │    │    SFTP     │    │  Processing │    │  Local LLM  │  │
│  │   Systems   │───▶│   Gateway   │───▶│   Engine    │───▶│   (Ollama)  │  │
│  │             │    │             │    │             │    │             │  │
│  │ • EHR/PMS   │    │ • Encrypted │    │ • Azure     │    │ • Llama 3   │  │
│  │ • Clearing- │    │ • Auth'd    │    │   Functions │    │ • 8B params │  │
│  │   houses    │◀───│   Users     │◀───│ • RAG       │◀───│ • Private   │  │
│  │ • Partners  │    │ • Isolated  │    │   Search    │    │             │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                                     │                             │
│         │                                     ▼                             │
│         │                            ┌─────────────┐                       │
│         │                            │  Knowledge  │                       │
│         │                            │    Base     │                       │
│    ONLY INTERNET                     │             │                       │
│      CONNECTION                      │ • 38K docs  │                       │
│                                      │ • Indexed   │                       │
│                                      │ • Searchable│                       │
│                                      └─────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight:** The SFTP gateway is the *only* internet-facing component. All AI processing, knowledge retrieval, and decision-making happens entirely within your infrastructure.

---

## Regulatory Compliance

### HIPAA (Health Insurance Portability and Accountability Act)

| HIPAA Requirement | How This Architecture Addresses It |
|-------------------|-----------------------------------|
| **Access Controls** | SFTP authentication with separate inbound/outbound users; role-based access |
| **Audit Controls** | Full logging of all file processing; immutable audit trail |
| **Integrity Controls** | Files moved to `processed/` folder after handling; checksums available |
| **Transmission Security** | SFTP provides encryption in transit; internal processing on isolated network |
| **Minimum Necessary** | RAG retrieves only relevant records; LLM sees limited context |

### HITRUST CSF

This architecture supports HITRUST certification by providing:

- **Control Category 01** - Information Protection Program: Documented data flows, isolated processing
- **Control Category 06** - Access Control: Segregated SFTP users, no shared credentials
- **Control Category 09** - Transmission Protection: Encrypted file transfer, no cloud transmission
- **Control Category 10** - Audit Logging: Comprehensive processing logs

### Colorado Privacy Regulations

**Colorado Privacy Act (CPA)** and **Colorado Consumer Protections for AI** considerations:

| Requirement | Implementation |
|-------------|----------------|
| **Data Minimization** | Only relevant knowledge base entries retrieved per request |
| **Purpose Limitation** | Processing engine performs single defined function |
| **Consumer Rights** | All data remains accessible within organization's control |
| **AI Transparency** | Deterministic RAG pipeline; explainable retrieval |
| **Opt-Out Rights** | No data shared with external AI providers |

**HB 21-1110 (Colorado Health Data Privacy)**: By processing locally, patient health data is never transmitted to out-of-state processors, simplifying compliance with Colorado's health data residency preferences.

---

## Technical Architecture

### Retrieval Augmented Generation (RAG)

RAG solves a fundamental limitation of Large Language Models: they only know what they were trained on. For healthcare claims processing, we need the AI to reference *your* specific:

- Payer policies and guidelines
- Historical adjudication decisions
- Provider contracts and fee schedules
- Medical coding references (ICD-10, CPT, HCPCS)
- Clinical criteria (InterQual, MCG, internal protocols)

#### How RAG Works

```
                    ┌──────────────────────────────────────────────────────┐
                    │              RETRIEVAL AUGMENTED GENERATION           │
                    └──────────────────────────────────────────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         │                                    │                                    │
         ▼                                    ▼                                    ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│   1. INGEST     │              │   2. RETRIEVE   │              │   3. GENERATE   │
│                 │              │                 │              │                 │
│ Your documents  │              │ User submits    │              │ LLM receives:   │
│ are processed   │              │ a request       │              │                 │
│ and indexed     │              │                 │              │ • User request  │
│                 │              │ System searches │              │ • Retrieved     │
│ • Parse text    │              │ knowledge base  │              │   context       │
│ • Extract keys  │              │ for relevant    │              │                 │
│ • Build search  │              │ documents       │              │ Generates       │
│   index         │              │                 │              │ informed        │
│                 │              │ Returns top     │              │ response        │
│ One-time setup  │              │ matches         │              │                 │
└─────────────────┘              └─────────────────┘              └─────────────────┘
         │                                │                                │
         ▼                                ▼                                ▼
   ┌───────────┐                  ┌───────────┐                    ┌───────────┐
   │ Knowledge │                  │  Relevant │                    │  Accurate │
   │   Base    │                  │  Context  │                    │  Response │
   │           │                  │           │                    │           │
   │ 38,357    │                  │ "Found 15 │                    │ Based on  │
   │ indexed   │                  │  matching │                    │ YOUR data │
   │ documents │                  │  records" │                    │ not just  │
   │           │                  │           │                    │ training  │
   └───────────┘                  └───────────┘                    └───────────┘
```

#### RAG vs. Fine-Tuning

| Approach | RAG (What We Built) | Fine-Tuning |
|----------|---------------------|-------------|
| **Setup Time** | Hours | Days to weeks |
| **Hardware** | Any computer | GPU required (expensive) |
| **Updates** | Instant (rebuild index) | Requires retraining |
| **Transparency** | Can see exactly what was retrieved | Black box |
| **Accuracy** | References actual documents | May hallucinate |
| **Cost** | Minimal | Significant compute costs |

**Recommendation:** RAG is the appropriate choice for healthcare applications where accuracy, auditability, and rapid updates are essential.

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW DIAGRAM                               │
└─────────────────────────────────────────────────────────────────────────────┘

    EXTERNAL                         INTERNAL (Air-Gapped from Internet)
    ────────                         ────────────────────────────────────

        │                            ┌─────────────────────────────────────┐
        │                            │                                     │
   ┌────▼────┐    Encrypted     ┌────▼────┐                               │
   │  SFTP   │    Upload        │ Inbound │                               │
   │ Client  │─────────────────▶│ Folder  │                               │
   │         │                  │         │                               │
   └─────────┘                  └────┬────┘                               │
                                     │                                     │
                                     │ Timer Trigger                       │
                                     │ (Every 5 min)                       │
                                     ▼                                     │
                               ┌───────────┐      ┌───────────┐           │
                               │ Processing│─────▶│    RAG    │           │
                               │  Engine   │      │  Search   │           │
                               │           │◀─────│           │           │
                               └─────┬─────┘      └─────┬─────┘           │
                                     │                  │                  │
                                     │                  ▼                  │
                                     │           ┌───────────┐            │
                                     │           │ Knowledge │            │
                                     │           │   Base    │            │
                                     │           │  38,357   │            │
                                     │           │  Records  │            │
                                     ▼           └───────────┘            │
                               ┌───────────┐                              │
                               │   Local   │                              │
                               │    LLM    │                              │
                               │  Ollama   │                              │
                               │ Llama 3.1 │                              │
                               └─────┬─────┘                              │
                                     │                                     │
                                     │ AI-Generated                        │
                                     │ Response                            │
                                     ▼                                     │
   ┌─────────┐                  ┌─────────┐                               │
   │  SFTP   │    Encrypted     │Outbound │                               │
   │ Client  │◀─────────────────│ Folder  │                               │
   │         │    Download      │         │                               │
   └─────────┘                  └─────────┘                               │
                                                                          │
                                     └─────────────────────────────────────┘
```

### Processing Guarantees

| Guarantee | Implementation |
|-----------|----------------|
| **Exactly-Once Processing** | Files moved to `processed/` subfolder after completion |
| **Idempotency** | Same input always produces consistent output |
| **Auditability** | Original input preserved; output timestamped |
| **Error Handling** | Failed files remain in queue; logged for review |

---

## Proof of Concept: Movie Recommendations

### Why Movies?

This POC uses a movie recommendation engine as a safe, non-sensitive proxy for healthcare claims processing. The architectural patterns are identical:

| Movie POC Component | Healthcare Equivalent |
|--------------------|----------------------|
| User movie preferences (text) | Claim submission / prior auth request |
| Movie database (38K films) | Payer policies, medical guidelines, coding references |
| RAG search for relevant movies | Policy lookup, similar case retrieval |
| LLM recommendation generation | Adjudication decision, auth determination |
| Recommendation output | Claim decision, auth approval/denial |

### Current Implementation

**Knowledge Base:** 38,357 movies indexed with:
- Title, year, genres
- Cast and director
- Plot summaries
- Ratings and popularity

**Processing Pipeline:**
1. User uploads `.txt` file with preferences via SFTP
2. Timer trigger fires every 5 minutes
3. RAG engine searches for relevant movies
4. LLM generates personalized recommendations using retrieved context
5. Output written to SFTP outbound folder

**Sample Input:**
```
I love movies with Tom Hanks and Leonardo DiCaprio.
My favorite genres are drama and thriller.
I really enjoyed Inception, The Shawshank Redemption, and Interstellar.
Please recommend some movies I might enjoy.
```

**Sample Output:**
```
Based on your preferences, here are 5 recommendations:

1. "Shutter Island" (2010) - Thriller/Drama
   Leonardo DiCaprio stars in this Scorsese masterpiece...

2. "Catch Me If You Can" (2002) - Drama/Crime
   Features both DiCaprio AND Hanks together...

[continues with personalized, accurate recommendations]
```

---

## Healthcare Application Roadmap

### Phase 1: Prior Authorization (Recommended Starting Point)

**Input:** Prior authorization request (procedure, diagnosis, clinical notes)

**Knowledge Base:**
- Payer medical policies
- InterQual / MCG criteria
- Historical authorization decisions
- Provider contract terms

**Output:** Authorization recommendation with:
- Approve / Deny / Pend for review
- Supporting policy citations
- Required documentation checklist
- Confidence score

### Phase 2: Claims Adjudication

**Input:** Claim data (837 format or extracted fields)

**Knowledge Base:**
- Fee schedules
- Coding guidelines (ICD-10, CPT, HCPCS)
- Bundling/unbundling rules
- Medical necessity criteria

**Output:** Adjudication recommendation with:
- Pay / Deny / Adjust
- Pricing calculation
- Edit explanations
- Appeal risk assessment

### Phase 3: Clinical Decision Support

**Input:** Patient case summary

**Knowledge Base:**
- Clinical pathways
- Drug formularies
- Care gap protocols
- Quality measure specifications

**Output:** Clinical recommendations with:
- Suggested interventions
- Medication alternatives
- Preventive care reminders
- Documentation improvements

---

## Infrastructure Requirements

### Current POC Hardware

| Component | Specification |
|-----------|---------------|
| **Device** | Apple Mac Mini (2024) |
| **Processor** | Apple M4 Pro, 14 cores |
| **Memory** | 64 GB unified |
| **GPU** | 20-core integrated |
| **Storage** | 512 GB SSD (expandable) |

**Estimated Cost:** ~$2,500 one-time

### Production Recommendations

| Scale | Hardware | Est. Cost |
|-------|----------|-----------|
| **Pilot** (100 claims/day) | Mac Mini M4 Pro 64GB | $2,500 |
| **Department** (1,000/day) | Mac Studio M2 Ultra 192GB | $8,000 |
| **Enterprise** (10,000+/day) | Linux server + NVIDIA GPU | $15,000+ |

### Software Stack (All Open Source / Free)

| Component | Technology | License |
|-----------|------------|---------|
| LLM Runtime | Ollama | MIT |
| LLM Model | Llama 3.1 8B | Meta Community |
| Processing Engine | Node.js / Azure Functions | MIT |
| SFTP Server | Azure Blob Storage SFTP | Pay-per-use |
| Vector Search | Custom (upgradeable to ChromaDB) | Apache 2.0 |

---

## Security Considerations

### Network Isolation

```
┌─────────────────────────────────────────────────────────────┐
│                    NETWORK ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────┘

     INTERNET          │         DMZ           │       INTERNAL
                       │                       │
   ┌─────────┐        │    ┌─────────┐       │    ┌─────────┐
   │ External│        │    │  SFTP   │       │    │   LLM   │
   │ Systems │◀──────▶│───▶│ Gateway │───────│───▶│ Server  │
   └─────────┘   SSH   │    └─────────┘       │    └─────────┘
                       │         │            │         │
                       │         │ Files      │         │ Local
                       │         │ Only       │         │ Only
                       │         ▼            │         ▼
                       │    ┌─────────┐       │    ┌─────────┐
                       │    │  Blob   │       │    │Knowledge│
                       │    │ Storage │───────│───▶│  Base   │
                       │    └─────────┘       │    └─────────┘
                       │                       │
```

**Key Security Controls:**
- SFTP is the only externally accessible service
- LLM and knowledge base have no internet connectivity
- Processing engine runs in isolated environment
- No PHI transmitted to external services

### Audit Trail

Every processed file generates:
- Timestamp of receipt
- Processing duration
- RAG queries executed
- LLM prompt and response
- Output file location

---

## Getting Started

### Prerequisites

- macOS device with Apple Silicon (M1/M2/M3/M4)
- Azure account (for SFTP blob storage)
- Node.js 18+

### Quick Start

```bash
# Clone and install
cd /path/to/project
npm install

# Build knowledge base index
node scripts/build-movie-index.js

# Configure environment
cp local.settings.json.example local.settings.json
# Edit with your Azure Storage connection string

# Start Ollama (separate terminal)
ollama serve

# Start processing engine
npm start

# Test the pipeline
node scripts/test-connection.js
curl http://localhost:7071/api/triggerProcessing
```

---

## Frequently Asked Questions

**Q: Is the AI making final decisions?**
A: No. The system provides recommendations with supporting evidence. Human review remains in the workflow for all consequential decisions.

**Q: What happens if the LLM produces an incorrect result?**
A: RAG significantly reduces hallucination by grounding responses in your actual documents. All outputs include the source documents used, enabling verification.

**Q: Can this scale to enterprise volume?**
A: Yes. The architecture supports horizontal scaling. For high-volume production, we recommend dedicated GPU servers.

**Q: How do we update the knowledge base?**
A: Run the index builder script whenever source documents change. Takes approximately 5 minutes for 40,000 documents.

**Q: What's the ongoing cost?**
A: After initial hardware purchase, the only recurring cost is Azure Blob Storage (~$20-50/month for typical usage). There are no per-transaction AI fees.

---

## Contact

**Catalyst Solutions**

For questions about this proof of concept or to discuss healthcare implementation:

[Contact information to be added]

---

*This document and the associated proof of concept were developed by Catalyst Solutions to demonstrate the viability of local LLM processing for sensitive healthcare data.*

*Last Updated: February 2026*
