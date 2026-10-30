# Code to Work Standards

**Why do people still need to review work produced by AI agents?**

Turn the reasons people correct AI output into explicit work standards, acceptance criteria, and evaluation cases.

![A human reviewer organizes AI-generated papers into evidence-linked work cards](assets/hero.png)

[한국어](README.md) · [27-page PDF, Korean](reports/workflow-standards-v0.1.pdf) · [Contribute](CONTRIBUTING.md)

## What this project does

We connect **code evidence → proposed SOPs and maps of work → practitioner observation → evaluation → change decisions**. Existing code tells us what a system appears to do. Practitioners and real cases tell us whether that behavior supports the job, where it fails, and what completion means.

The current release is **v0.1: proposed standards, not practitioner-validated procedures**. Examples are synthetic and unexecuted. No quality or productivity gains have been measured yet.

## Initial workflows

| Domain | Outputs | Focus |
|---|---|---|
| [Meeting notes and minutes](workflows/notes/README.md) | Personal/mobile notes; shared meeting minutes | Requests versus agreement, ownership, deadlines, source evidence, follow-up state |
| [Company research and product fit](workflows/company-analysis/README.md) | Company/product facts; sales-oriented fit assessment | Entity identity, source scope, customer-need hypotheses, product constraints, next action |

There are 26 proposed SOP stages and 24 product requirements. A stage is **not** a model call, and assigning responsibility does **not** imply a separate approval at every stage.

## Start with one case

1. Read a synthetic [notes example](examples/SYN-N-001.md) or [research example](examples/SYN-B-001.md).
2. Identify one questionable judgment rule.
3. Record a practitioner’s sequence of actions and reasons for corrections in the [observation template](templates/observation.md).
4. Propose a change with evidence, acceptance criteria, and a counterexample.
5. Compare under fixed conditions, then record adoption, revision, or rejection.

```bash
git clone https://github.com/thuygom/code-to-work-standards.git
cd code-to-work-standards
python3 scripts/check_repository.py
python3 scripts/summarize_evaluation.py
```

Python 3.10+ is required for the standard-library-only tools. No LLM or external service is called by these commands. The initial evaluation files contain headers only; zero measurements do not mean zero quality.

## Open contribution

[Visit the contribution website](https://standard.linh.day/) (Korean): explore domains, compose a case or import a UTF-8 `.md`/`.txt` file, review it, then submit it as a GitHub issue. Files are read locally in your browser; GitHub handles final submission and attachments. New domains can be proposed through the [dedicated issue template](https://github.com/thuygom/code-to-work-standards/issues/new?template=new-domain.md). Registered workflow IDs and output types live in [the workflow registry](workflows/registry.json).

We welcome practitioners, domain experts, developers, researchers, and documentation contributors. Useful contributions include anonymized cases you may publish, synthetic counterexamples, decision rules, work maps, evaluation methods, and translation. The smallest contribution is **one case + one rule + one way to check it**.

Keep customer data, credentials, original meeting recordings, and independent holdout cases outside the public repository. Code references may point to access-controlled repositories; contributions do not require access to those original applications.

[Contribution guide](CONTRIBUTING.md) · [Operating model](docs/operating-model.md) · [Evaluation](evaluation/README.md) · [First-week plan](docs/week-01-plan.md)

## License

Original project documents, templates, and utilities use the [MIT License](LICENSE). External references and source applications retain their own rights. Bundled fonts retain their OFL license. The hero is an AI-generated conceptual illustration, not an actual interface or performance result.
