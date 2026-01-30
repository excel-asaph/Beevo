# Beevo Future Roadmap

These are the "insanely mad" implementation ideas to elevate the system from an optimizer to a fully autonomous brand-building ecosystem.

## 1. Multi-Modal Asset Chaining (Image -> Video)
Currently, we generate video directly. The future state involves:

- **Image Pre-Composition**: Generating a high-fidelity brand image first using the Color Palettes, Logo Structure, and Logo Inspirations.
- **Image-to-Video Synthesis**: Using that static image as the "Source Frame" for Video Generation (Veo/Luma/Gen-3).
- **Benefit**: Ensures the generated assets are the perfect physical manifestation of the Brand Design.

## 2. Human-in-the-Loop (HITL) & Notification System
Adding an oversight layer for strategic pivots and numeric control.

### The Feedback System (Prioritized Input)
- **Granular Feedback**: Users can provide specific directive feedback for each independent section (Hero, Proof, PAS, Spec, Social, Offer).
- **Prompt Injection**: This feedback is treated as a "High Priority Constraint" in the AI prompt, overriding default agent behavior when generating the next iteration.

### Numeric Control Center (Thresholds)
A dedicated interface to expose the internal math of the autonomous system.
- **Configurable Constraints**: Users can adjust the min/max values for key metrics (e.g., Retention Rate, Click-Through Rate) that the Watcher Agents use to trigger optimizations.
- **Defaults vs. Custom**: The system defaults to our optimized hardcoded values. User adjustments override these defaults within safe "Min/Max" guardrails to prevent system breakage.

### Notification & Intervention Logic
A toggle-able "Traffic Control" system for the optimization loop.
- **Modes**:
    - **Autonomous (Default)**: The system optimizes freely based on thresholds.
    - **HITL Enabled**: The system pauses for approval at specific gates.
- **Phased Gates**:
    - **Pre-Optimization (Strategy)**: Agent proposes a pivot (e.g., "Change Hero Video"). User approves or edits strategy.
    - **Post-Optimization (Verification)**: Agent presents the rendered result. User approves deployment.
- **Auto-Proceed**: A timer (e.g., 10 mins) that automatically approves the AI's best decision if the user is away, ensuring the loop doesn't stall indefinitely.

### Features & Boosters
- **Global Section Locks**: Ability to "Lock" specific sections (e.g., "Don't touch the Offer") to prevent the AI from optimizing them, while leaving other sections active.
- **Threshold Presets (Brand Tiers)**: Pre-configured sets of threshold values tailored for different goals.
    - *Explanation*: Instead of adjusting 20 individual sliders, a user selects a "Tier".
    - *Example "Conservative Tier"*: High thresholds (only fix if broken), Low mutation velocity (small changes).
    - *Example "Aggressive Growth Tier"*: High sensitivity (fix everything), High velocity (radical experiments).

## 3. Dynamic Structural Layouts
Moving beyond fixed CSS templates:

- **Fluid UI Construction**: The agent generates the layout structure itself (Flexbox/Grid/CSS Variables) rather than just choosing a theme.
- **Trust-Centric Intelligence**: Logic that ensures even extreme layout mutations maintain "Trust Signals" (alignment, whitespace, contrast).

## 4. Global Sync & Deployment (Local-to-Cloud)
Bridging the gap between simulation and the real world:

- **Local Sandbox**: Continue optimizing in the local environment for safety.
- **GitHub Sync**: Once a block reaches a performance "Champion" state, the system automatically pushes the update to GitHub.
- **Cloud Run / Automated CD**: A deployment trigger pulls the updates to the online live version.
- **Result**: Real-time optimization reflecting globally across both local and production environments.
