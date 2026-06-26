# Practices for Analyzing Codebase Health

A referenced survey of established techniques for assessing the health of a codebase, focused on two areas:

1. **Code metrics & maintainability** — static, structural measures of code and the quality models built on them.
2. **Architecture, evolution & delivery** — system-level structure, how it decays over time, and the delivery/organizational signals that surround it.

It closes with a short note on where **git-history behavioral analysis** (the lineage Xray belongs to) sits relative to these, and an annotated reading list.

> Status: reviewed against a multi-source, adversarially-verified research pass (23 sources, 25 claims verified, 3 refuted). Claims tied to primary/peer-reviewed sources are marked where it matters; a few well-known book/standard citations are high-confidence general knowledge rather than freshly re-fetched (noted at the end).

---

## 1. Code metrics & maintainability

Static metrics try to answer "how hard is this code to understand and change?" without running it or looking at its history. They are cheap, language-tooled, and trend-able — but each is a **proxy**, and every one of them can be gamed or misread in isolation.

### 1.1 Size and complexity

- **Lines of code (LOC / SLOC).** The crudest measure, yet stubbornly useful as a *normalizer* (defects per KLOC) and as the size axis in most other analyses. Blind to complexity and intent.
- **Cyclomatic complexity (McCabe, 1976).** Counts linearly independent paths through a function (`E − N + 2P`), i.e. the number of decision points + 1. Correlates with testing effort (it's a lower bound on the number of test cases for full branch coverage) and, loosely, with defect-proneness. **Blind spot:** treats a flat `switch` with 20 cases the same as deeply nested conditionals, though the latter is far harder to follow.
- **Cognitive complexity (G. Ann Campbell / SonarSource, white paper 2018).** A deliberate redesign of cyclomatic complexity to track *understandability* rather than testability — SonarSource's own framing is "testability != understandability." Three rules: increment for each break in linear control flow, add **extra** increments for nesting, and ignore shorthand that doesn't add mental load (a `switch` counts once). Notably, it's the **first solely code-based metric empirically validated to reflect understandability** — it positively correlates with developers' comprehension time and subjective ratings (Muñoz Barón, Wyrich & Wagner, ESEM 2020, a meta-analysis of ~24,000 evaluations). Now standard in SonarQube and generally a better "is this hard to read?" signal than McCabe.
- **Halstead metrics (Halstead, 1977).** Derives *volume*, *difficulty*, and *effort* from counts of distinct/total operators and operands. Largely of historical importance today, but it survives as an input to the Maintainability Index.

### 1.2 The Maintainability Index (and why to distrust it)

The **Maintainability Index (MI)** (Coleman, Ash, Lowther & Oman, "Using Metrics to Evaluate Software System Maintainability," *IEEE Computer*, 1994) combines Halstead Volume, cyclomatic complexity, and LOC — a later four-metric variant adds comment ratio — into a single number; Microsoft's Visual Studio variant rescales it to 0–100. Its appeal is a single "maintainability score."

**Caveats are significant** and worth stating loudly:

- **No root-cause traceability.** Because MI is a composite, a low score doesn't tell you *what* caused it or how to raise it — which kills practitioner trust (Heitlager, Kuipers & Visser, "Maintainability Index Revisited," SQM/CSMR 2007).
- **The averaging flaw.** MI aggregates by averaging, but per-unit complexity follows a **power-law distribution**: the mean is dragged down by trivial units (getters/setters at complexity 1) while real maintenance pain concentrates in a few outliers with complexity > 100. The average *masks exactly the parts that matter* (Heitlager et al. 2007; Arie van Deursen, "Think Twice Before Using the Maintainability Index," 2014).
- **Magic constants & gaming.** The coefficients were fit to a small set of 1990s C/Pascal systems; the comment-ratio term can be gamed by adding comments; rescaled versions hide all of this.

The consensus is to treat MI as, at best, a rough relative trend — never an absolute grade. The averaging critique is also a direct argument *for* outlier-focused approaches (hotspots, §3): don't average risk, find the spikes.

### 1.3 Coupling and cohesion

The oldest structural ideas in the field — **coupling** (interdependence between modules) should be low, **cohesion** (relatedness within a module) should be high. The vocabulary comes from Constantine & Yourdon's structured design (1970s) and Parnas's information hiding (1972).

- **CK metrics (Chidamber & Kemerer, 1994).** The canonical OO suite: WMC (weighted methods per class), DIT (depth of inheritance), NOC (number of children), **CBO (coupling between objects)**, RFC (response for a class), and **LCOM (lack of cohesion of methods)**. Empirically validated as defect predictors (Basili, Briand & Melo, 1996) — but also heavily critiqued, and the critiques matter:
  - **Collinearity.** Across ~200 projects, CBO, number-of-methods, and RFC are strongly correlated (~0.5 to >0.8); using the whole suite as model inputs is statistically redundant and can invalidate defect-prediction models — use a curated subset (Succi, Pedrycz, Djokic, Zuliani & Russo, *Empirical Software Engineering*, 2005).
  - **Measurement-theoretic weakness.** Several CK metrics (notably CBO and especially **LCOM**) fail to establish a sound empirical relation system, making them theoretically deficient as measures (Hitz & Montazeri, *IEEE TSE* 22(4), 1996).
- **Martin's package metrics (Robert C. Martin, "OO Design Quality Metrics: An Analysis of Dependencies," 1994; expanded in *Clean Architecture*, 2017).** For dependency health between components: **Instability** `I = Ce / (Ca + Ce)` (efferent / total coupling), **Abstractness** `A = abstract types / total types`, and **Distance from the main sequence** — the line from (0,1) to (1,0) on the A-vs-I plane — normalized as `Dn = |A + I − 1|`. The idea: components should be either abstract-and-stable or concrete-and-unstable; ones far off the main sequence sit in the "zone of pain" (rigid, concrete, depended-on) or "zone of uselessness" (abstract, unused).
- **Connascence (Page-Jones, 1990s).** A finer taxonomy of *kinds* and *strength* of coupling (name, type, meaning, position, execution order, etc.), useful as a refactoring lens.
- **Fan-in / fan-out.** Simple directional coupling counts still used in many tools.

### 1.4 Duplication

Copy-paste detection (token- or AST-based) flags clones that multiply the cost of change. Standard tooling: **PMD's CPD**, **Simian**, and the duplication detectors built into SonarQube. High duplication is one of the more actionable, less arguable metrics.

### 1.5 Standardized quality models

- **ISO/IEC 25010 (SQuaRE, 2011; revised 2023).** The product-quality standard, successor to ISO/IEC 9126. Defines eight quality characteristics — functional suitability, performance efficiency, compatibility, usability, reliability, security, **maintainability**, portability — with maintainability decomposed into modularity, reusability, analysability, modifiability, and testability. Useful as a *shared vocabulary* and checklist; it does not prescribe how to measure.
- **SQALE — "Software Quality Assessment based on Lifecycle Expectations" (Letouzey, IEEE 2010; "Managing Technical Debt with the SQALE Method," *IEEE Software*, 2012).** A hierarchical model (characteristics like testability, reliability, changeability, maintainability, reusability) that expresses findings as a **remediation index** — the work-effort to fix non-compliances. Crucially, because every index is in uniform units (effort), aggregating by **simple addition** is measurement-theoretically valid (unlike averaging composites). Underpins SonarQube's technical-debt ratio. Convenient and well-founded — but only as honest as the underlying rules and effort estimates.
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
- **Chidamber & Kemerer — "A Metrics Suite for Object Oriented Design," _IEEE TSE_ 20(6), 1994.** The CK metrics (CBO, LCOM, WMC, DIT, NOC, RFC). Validated by **Basili, Briand & Melo (_IEEE TSE_, 1996)**; critiqued by **Hitz & Montazeri ("Chidamber and Kemerer's Metrics Suite: A Measurement Theory Perspective," _IEEE TSE_ 22(4), 1996)** and **Succi et al. ("An Empirical Exploration of the Distributions of the CK Object-Oriented Metrics Suite," _Empirical Software Engineering_ 10(1), 2005)** on collinearity.
- **G. Ann Campbell — "Cognitive Complexity: A new way of measuring understandability" (SonarSource white paper, 2018).** The rationale and definition. Independently validated by **Muñoz Barón, Wyrich & Wagner — "An Empirical Validation of Cognitive Complexity as a Measure of Source Code Understandability" (_ESEM_, 2020; arXiv:2007.12520).**
- **Coleman, Ash, Lowther & Oman — "Using Metrics to Evaluate Software System Maintainability," _IEEE Computer_ 27(8), 1994.** Origin of the Maintainability Index. Pair with **Heitlager, Kuipers & Visser — "A Practical Model for Measuring Maintainability" / "Maintainability Index Revisited" (SQM/CSMR, 2007)** and **Arie van Deursen — "Think Twice Before Using the Maintainability Index" (2014)** for the critiques.
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

## Verification notes

This survey was checked against a multi-source research pass (23 sources fetched, 25 claims put through 3-vote adversarial verification, 22 confirmed).

**Confirmed against primary / peer-reviewed sources:** cognitive complexity's intent and empirical validation (SonarSource; Muñoz Barón et al., ESEM 2020), the Maintainability Index formula + its no-traceability and power-law-averaging critiques (Heitlager et al., 2007; van Deursen, 2014), Martin's instability/abstractness/main-sequence definitions (Martin, 1994), the CK collinearity and measurement-theory critiques (Succi et al., 2005; Hitz & Montazeri, 1996), the SQALE remediation-index model (Letouzey), evolutionary architecture & fitness functions (Ford/Parsons/Kua), and the SPACE framework (Forsgren et al., 2021).

**High-confidence general knowledge, not independently re-fetched this run:** the book citations (Fowler, *Clean Architecture*, *Accelerate*, Tornhill), Lehman's 1980 paper, ISO/IEC 25010, Coleman et al. 1994, and the DORA four-metric list (well-attested but not formally verified here). Titles/authors/years are reliable; treat exact editions/years as worth a quick confirm if cited formally.

**Deliberately excluded (refuted in verification):** a specific five-metric characterization of the SIG maintainability model; the claim that CK's DIT/NOC "variance never exceeds 10"; and the over-broad definition that "any tool assessing an architectural characteristic is a fitness function" (the concept is narrower — automated, objective checks of chosen characteristics).

**Open questions worth a follow-up** (surfaced by the research, not resolved here): the current empirical standing of DORA's metrics and their correlation with SPACE in recent State-of-DevOps reports; which of Lehman's laws still hold under continuous delivery / microservices; whether a minimal non-redundant "core set" of static metrics reliably predicts defects across languages; and the strongest *independent* (non-vendor) evidence that acting on git-history hotspots reduces defects versus acting on static metrics alone.

---

*Compiled for the Xray project. Xray itself implements the behavioral branch (§3) — LOC, hotspots, churn, coupling, and ownership from git history — which is why this survey deliberately maps the surrounding static, architectural, and delivery practices it does **not** cover.*
