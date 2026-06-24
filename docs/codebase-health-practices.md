# Practices for Analyzing Codebase Health

A referenced survey of established techniques for assessing the health of a codebase, focused on two areas:

1. **Code metrics & maintainability** — static, structural measures of code and the quality models built on them.
2. **Architecture, evolution & delivery** — system-level structure, how it decays over time, and the delivery/organizational signals that surround it.

It closes with a short note on where **git-history behavioral analysis** (the lineage Xray belongs to) sits relative to these, and an annotated reading list.

> Status: initial draft from working knowledge. A multi-source research pass is in progress; verified additions and any citation corrections will be folded in.

---

## 1. Code metrics & maintainability

Static metrics try to answer "how hard is this code to understand and change?" without running it or looking at its history. They are cheap, language-tooled, and trend-able — but each is a **proxy**, and every one of them can be gamed or misread in isolation.

### 1.1 Size and complexity

- **Lines of code (LOC / SLOC).** The crudest measure, yet stubbornly useful as a *normalizer* (defects per KLOC) and as the size axis in most other analyses. Blind to complexity and intent.
- **Cyclomatic complexity (McCabe, 1976).** Counts linearly independent paths through a function (`E − N + 2P`), i.e. the number of decision points + 1. Correlates with testing effort (it's a lower bound on the number of test cases for full branch coverage) and, loosely, with defect-proneness. **Blind spot:** treats a flat `switch` with 20 cases the same as deeply nested conditionals, though the latter is far harder to follow.
- **Cognitive complexity (Campbell / SonarSource, 2017).** A deliberate redesign of cyclomatic complexity to track *understandability* rather than testability: it ignores constructs that don't add mental load (e.g. a `switch` counts once) and penalizes **nesting** and broken control flow. Now widely used in SonarQube. Still a heuristic, but generally a better "is this function hard to read?" signal than McCabe.
- **Halstead metrics (Halstead, 1977).** Derives *volume*, *difficulty*, and *effort* from counts of distinct/total operators and operands. Largely of historical importance today, but it survives as an input to the Maintainability Index.

### 1.2 The Maintainability Index (and why to distrust it)

The **Maintainability Index (MI)** (Oman & Hagemeister, 1992–94) combines Halstead Volume, cyclomatic complexity, LOC, and (originally) comment ratio into a single number; Microsoft's Visual Studio variant rescales it to 0–100. Its appeal is a single "maintainability score."

**Caveats are significant** and worth stating loudly: the formula's coefficients were fit to a handful of small C/Pascal systems in the early 1990s; the constants are essentially magic numbers; the comment-ratio term can be gamed by adding comments; and the rescaled versions obscure all of this. The practitioner consensus (e.g. Arie van Deursen, "Think Twice Before Using the Maintainability Index," 2014) is to treat MI as, at best, a rough relative trend — never an absolute grade.

### 1.3 Coupling and cohesion

The oldest structural ideas in the field — **coupling** (interdependence between modules) should be low, **cohesion** (relatedness within a module) should be high. The vocabulary comes from Constantine & Yourdon's structured design (1970s) and Parnas's information hiding (1972).

- **CK metrics (Chidamber & Kemerer, 1994).** The canonical OO suite: WMC (weighted methods per class), DIT (depth of inheritance), NOC (number of children), **CBO (coupling between objects)**, RFC (response for a class), and **LCOM (lack of cohesion of methods)**. Empirically validated as defect predictors (Basili, Briand & Melo, 1996).
- **Martin's package metrics (Robert C. Martin, 1994/2002).** For dependency health between components: **Instability** `I = Ce / (Ca + Ce)` (efferent / total coupling), **Abstractness** `A = abstract types / total types`, and **Distance from the main sequence** `D = |A + I − 1|` — the idea that packages should be either abstract-and-stable or concrete-and-unstable, and ones far off that line are "zones of pain/uselessness."
- **Connascence (Page-Jones, 1990s).** A finer taxonomy of *kinds* and *strength* of coupling (name, type, meaning, position, execution order, etc.), useful as a refactoring lens.
- **Fan-in / fan-out.** Simple directional coupling counts still used in many tools.

### 1.4 Duplication

Copy-paste detection (token- or AST-based) flags clones that multiply the cost of change. Standard tooling: **PMD's CPD**, **Simian**, and the duplication detectors built into SonarQube. High duplication is one of the more actionable, less arguable metrics.

### 1.5 Standardized quality models

- **ISO/IEC 25010 (SQuaRE, 2011; revised 2023).** The product-quality standard, successor to ISO/IEC 9126. Defines eight quality characteristics — functional suitability, performance efficiency, compatibility, usability, reliability, security, **maintainability**, portability — with maintainability decomposed into modularity, reusability, analysability, modifiability, and testability. Useful as a *shared vocabulary* and checklist; it does not prescribe how to measure.
- **SQALE (Letouzey, 2012).** A method for organizing quality rules and expressing findings as **remediation effort** (time to fix), which underpins SonarQube's technical-debt ratio. Turns scattered rule violations into a single "debt" figure — convenient, but only as honest as the underlying rules and effort estimates.
- **The technical-debt metaphor (Cunningham, OOPSLA 1992; Fowler's quadrant).** Not a metric but the framing most teams use to talk about deferred quality; it gives metrics a business narrative ("interest payments").

### How these relate, and when to use them

Size → complexity → coupling/cohesion → quality model is roughly a ladder from *local* to *structural* to *organizational vocabulary*. In practice:

- Use **complexity** (prefer cognitive over cyclomatic) and **duplication** as everyday, function/file-level guardrails in CI.
- Use **coupling/cohesion** metrics when reasoning about *module/component* boundaries and refactoring targets.
- Use **ISO 25010 / SQALE** when you need a shared definition of "quality" across a team or a contractual/audit context.
- Treat **single-number indices (MI, debt ratio)** as trends, never grades, and never as a substitute for reading the code.

**The universal blind spot:** static metrics describe the code *as it is now*, with no sense of which parts actually matter — a horrifically complex file that no one ever touches is a low priority, and these metrics can't tell you that. That gap is exactly what behavioral analysis (§3) and delivery metrics (§2.3) fill.

---

## 2. Architecture, evolution & delivery

Zooming out from individual files to the system, how it changes, and the organization shipping it.

### 2.1 Dependency, modularity & architectural erosion

- **Dependency Structure Matrix (DSM).** A square matrix of inter-module dependencies (origin: Steward, 1981; popularized for software by Baldwin & Clark's *Design Rules*, 2000). Makes **cycles** and layering violations visible and supports a **propagation cost** measure — the fraction of the system reachable through dependencies when a change ripples (MacCormack, Rusnak & Baldwin, 2006). Tools: Structure101, Lattix, NDepend.
- **Modularity metrics.** Beyond DSM: clustering quality, "core/periphery" structure, and component cohesion. The empirical finding from MacCormack et al. is that more modular designs propagate changes less and are easier to evolve.
- **Architectural erosion / "software aging" (Parnas, 1994).** The observation that architecture decays as expedient changes accumulate, drifting from the intended design ("architecture drift/erosion"). This is the *problem* that the following two practices try to keep in check.
- **Architectural fitness functions (Ford, Parsons & Kua, *Building Evolutionary Architectures*, 2017).** Executable, automated checks that guard chosen architectural characteristics (e.g. "no cycles between these layers," "P95 latency < X," "the domain layer imports nothing from web"). The key move is making architectural rules *testable in CI* rather than enforced by review or hope. Tooling: **ArchUnit** (Java), **jQAssistant** (graph/Neo4j rules), dependency-cruiser (JS), NetArchTest (.NET).

### 2.2 Laws of software evolution

**Lehman's laws of software evolution** (Lehman & Belady, formulated 1974 onward; consolidated in *Program Evolution*, 1985; refined through the 1990s FEAST work) describe how real, used systems ("E-type" software) change. The most cited:

- **Continuing change** — a system must keep changing or become progressively less useful.
- **Increasing complexity** — as it changes, complexity rises unless work is explicitly done to reduce it.
- **Continuing growth**, **declining quality**, and the system as a **self-regulating feedback system**.

The practical takeaway for health analysis: complexity growth and quality decline are the *default trajectory*, so maintainability work is not optional cleanup — it's the counter-force that keeps the laws from winning. This is the theoretical backbone for tracking metric *trends over time* rather than absolute snapshots.

### 2.3 Delivery & organizational health

The insight here is that codebase health shows up in *flow*, not just structure.

- **DORA / the four key metrics (Forsgren, Humble & Kim, *Accelerate*, 2018; ongoing State of DevOps research).** **Deployment frequency**, **lead time for changes**, **change failure rate**, and **time to restore service** — statistically linked to both delivery performance and organizational outcomes. A later fifth (reliability/operational performance) was added. These are outcome metrics: a healthy codebase tends to produce good DORA numbers, and degrading numbers are an early warning.
- **SPACE framework (Forsgren, Storey, Maddila, Zimmermann, Houck & Butler, ACM Queue, 2021).** A deliberate corrective to single-metric "productivity": five dimensions — **S**atisfaction & well-being, **P**erformance, **A**ctivity, **C**ommunication & collaboration, **E**fficiency & flow — meant to be sampled in combination so no one number is gamed. Pairs naturally with DORA.

### How these relate, and when to use them

- Use **dependency/modularity analysis + fitness functions** to keep *structure* from eroding — they're proactive guardrails against Lehman's "increasing complexity."
- Use **Lehman's laws** as the conceptual frame for *why you measure trends*, not as something you compute.
- Use **DORA + SPACE** to measure the *consequences* of codebase health at the team/delivery level, and to connect engineering quality to business stakeholders.

**Blind spots:** delivery metrics can be gamed (deploy frequency without quality) and don't localize *where* in the code the problem is; architectural metrics catch structural rot but not "this module is fine architecturally yet changed every day by five people."

---

## 3. Where behavioral (git-history) analysis fits

Static metrics (§1) and architectural analysis (§2.1) describe structure; delivery metrics (§2.3) describe outcomes. **Behavioral code analysis** — mining the version-control history — fills the gap between them by adding the dimension of *what actually changes*:

- **Hotspots** = complexity/size **×** change frequency (churn), so attention goes to code that is both hard *and* volatile (the "intersection" idea).
- **Change/temporal coupling** = files that repeatedly change together regardless of static dependencies — surfacing hidden architectural coupling that DSMs miss.
- **Knowledge maps / bus factor** = ownership and key-person risk derived from authorship.

This lineage is most associated with **Adam Tornhill** (*Your Code as a Crime Scene*; *Software Design X-Rays*) and his open-source `code-maat` engine / CodeScene product, building on earlier empirical work that **code churn predicts defects** (e.g. Nagappan & Ball, 2005). Its strength is *prioritization* — it tells you which of the things static metrics flagged are actually worth fixing. Its limit is that it needs meaningful history and says nothing about a brand-new or rarely-committed codebase. (This is the space the **Xray** tool in this repo operates in.)

The three families are complementary: **static** tells you what's complex, **behavioral** tells you what's complex *and changing*, **delivery** tells you whether any of it is hurting your ability to ship.

---

## Annotated reading list

### Books

- **Adam Tornhill — _Your Code as a Crime Scene_ (Pragmatic Bookshelf, 2015; 2nd ed. 2024).** The accessible entry point to behavioral code analysis — hotspots, change coupling, knowledge maps.
- **Adam Tornhill — _Software Design X-Rays: Fix Technical Debt with Behavioral Code Analysis_ (Pragmatic Bookshelf, 2018).** The deeper, more architectural follow-up; connects history-mining to technical-debt prioritization.
- **Neal Ford, Rebecca Parsons & Patrick Kua — _Building Evolutionary Architectures_ (O'Reilly, 2017; 2nd ed. 2022 with Pramod Sadalage).** Source of "architectural fitness functions"; how to make architecture testable.
- **Nicole Forsgren, Jez Humble & Gene Kim — _Accelerate: The Science of Lean Software and DevOps_ (IT Revolution, 2018).** The research behind the DORA four key metrics.
- **Robert C. Martin — _Clean Architecture_ (Prentice Hall, 2017)** and **_Agile Software Development: Principles, Patterns, and Practices_ (Prentice Hall, 2002).** Component cohesion/coupling principles and the instability/abstractness/main-sequence metrics.
- **Mark Richards & Neal Ford — _Fundamentals of Software Architecture_ (O'Reilly, 2020).** Modern treatment of modularity, coupling, connascence, and architecture metrics.
- **Martin Fowler — _Refactoring: Improving the Design of Existing Code_ (Addison-Wesley, 1999; 2nd ed. 2018).** Code smells as the qualitative counterpart to metrics; the technical-debt quadrant.
- **Michael Feathers — _Working Effectively with Legacy Code_ (Prentice Hall, 2004).** The tactics for safely changing code that scores badly on every metric.
- **Diomidis Spinellis — _Code Quality: The Open Source Perspective_ (Addison-Wesley, 2006).** Maintainability and quality attributes grounded in real open-source code.
- **Steve McConnell — _Code Complete_ (2nd ed., Microsoft Press, 2004).** Broad, evidence-informed construction practices, including complexity and readability.

### Foundational papers & standards

- **Thomas J. McCabe — "A Complexity Measure," _IEEE TSE_ SE-2(4), 1976.** Cyclomatic complexity.
- **Maurice Halstead — _Elements of Software Science_ (Elsevier, 1977).** Halstead volume/difficulty/effort.
- **Chidamber & Kemerer — "A Metrics Suite for Object Oriented Design," _IEEE TSE_ 20(6), 1994.** The CK metrics (CBO, LCOM, WMC, DIT, NOC, RFC).
- **Basili, Briand & Melo — "A Validation of Object-Oriented Design Metrics as Quality Indicators," _IEEE TSE_, 1996.** Empirical evidence CK metrics predict defects.
- **G. Ann Campbell — "Cognitive Complexity: A new way of measuring understandability" (SonarSource white paper, 2017).** The rationale and definition behind cognitive complexity.
- **Oman & Hagemeister — Maintainability Index papers (1992, 1994).** Origin of MI. Pair with **Arie van Deursen — "Think Twice Before Using the Maintainability Index" (2014)** for the critique.
- **Lehman — "Programs, Life Cycles, and Laws of Software Evolution," _Proc. IEEE_, 1980**, and **Lehman & Belady — _Program Evolution: Processes of Software Change_ (1985).** The laws of software evolution.
- **Parnas — "On the Criteria To Be Used in Decomposing Systems into Modules," _CACM_, 1972**, and **"Software Aging," 1994.** Modularity/information hiding, and architectural erosion.
- **MacCormack, Rusnak & Baldwin — "Exploring the Structure of Complex Software Designs," _Management Science_, 2006.** DSM-based modularity and propagation cost.
- **Nagappan & Ball — "Use of Relative Code Churn Measures to Predict System Defect Density," _ICSE_, 2005.** Empirical basis for churn-as-risk.
- **Forsgren, Storey, Maddila, Zimmermann, Houck & Butler — "The SPACE of Developer Productivity," _ACM Queue_, 2021.** The SPACE framework.
- **Ward Cunningham — "The WyCash Portfolio Management System," _OOPSLA_, 1992.** The technical-debt metaphor's origin.
- **Jean-Louis Letouzey — "The SQALE Method for Evaluating Technical Debt," 2012.** The model behind debt-ratio tooling.
- **ISO/IEC 25010 (2011; revised 2023).** Product quality model (successor to ISO/IEC 9126).

### Tools

- **SonarQube / SonarCloud (SonarSource).** Multi-language static analysis; cognitive complexity, duplication, SQALE-based technical debt, quality gates.
- **CodeScene (Adam Tornhill / CodeScene AB).** Behavioral code analysis productized — hotspots, change coupling, knowledge maps; the commercial sibling of the books.
- **code-maat (open source, Tornhill).** The original command-line engine for mining git history (hotspots, coupling).
- **Understand (SciTools).** Deep static metrics and dependency/architecture exploration across many languages.
- **Structure101 / Lattix.** Dependency Structure Matrix and modularity/architecture management.
- **NDepend (.NET).** Metrics (incl. abstractness/instability), dependency graph & matrix, and custom code rules (CQLinq).
- **jQAssistant (+ Neo4j) and ArchUnit (Java).** Architecture-as-code / fitness-function enforcement in CI.
- **Radon (Python), lizard (multi-language), gocyclo (Go).** Lightweight complexity/MI/Halstead CLIs.
- **PMD CPD, Simian.** Copy-paste / duplication detection.
- **Designite / DesigniteJava.** Design- and architecture-smell detection.
- **scc, cloc, tokei.** Fast line counting (the size axis underneath most of the above).

---

*Compiled for the Xray project. Xray itself implements the behavioral branch (§3) — LOC, hotspots, churn, coupling, and ownership from git history — which is why this survey deliberately maps the surrounding static, architectural, and delivery practices it does **not** cover.*
