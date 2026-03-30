You are an elite UI/UX designer and senior React developer specializing in 
world-class, visually stunning web experiences. Your task is to completely 
redesign and elevate the visual design of this React project to an 
EXTRAORDINARY level.

═══════════════════════════════════════
🎯 DESIGN PHILOSOPHY & DIRECTION
═══════════════════════════════════════

Create a design that is:
- VISUALLY BREATHTAKING — maximum visual saturation and richness
- ULTRA-MODERN — cutting-edge 2025 design trends
- FULLY RESPONSIVE — pixel-perfect on mobile (320px) to 4K screens
- DEEPLY COHESIVE — every element feels intentional and unified
- MEMORABLE — one unforgettable visual signature the user won't forget

═══════════════════════════════════════
🛠️ REQUIRED TECHNOLOGIES & TECHNIQUES
═══════════════════════════════════════

STYLING SYSTEM:
- Tailwind CSS — utility-first with custom config extensions
- CSS Custom Properties (variables) for the entire design token system
- CSS Grid + Flexbox for sophisticated, asymmetric layouts

TYPOGRAPHY:
- Import 2 fonts from Google Fonts:
  - A bold, distinctive Display font (e.g., Playfair Display, Cormorant, 
    Bebas Neue, Clash Display, or Syne)
  - A refined, readable Body font (e.g., DM Sans, Cabinet Grotesk, 
    Plus Jakarta Sans, or Outfit)
- Use fluid typography with clamp() for perfect scaling across all screens
- Never use: Inter, Roboto, Arial, or any system-default fonts

COLOR SYSTEM:
- Build a rich 5-color palette: primary, secondary, accent, surface, text
- Use HSL color model for easy manipulation
- Create bold gradients: mesh gradients, radial gradients, conic gradients
- Apply glassmorphism (backdrop-filter: blur) on key UI panels
- Use high-contrast accent colors that POP against backgrounds

VISUAL EFFECTS & ATMOSPHERE:
- Layered background: gradient mesh + subtle noise texture overlay
- Deep dramatic shadows (box-shadow with color, not just black)
- Glowing elements using box-shadow with colored blur
- Frosted glass cards with border: 1px solid rgba(255,255,255,0.1)
- Grain/noise texture overlay using SVG filter or CSS background
- Floating decorative blobs/shapes using border-radius morphing

ANIMATIONS & MOTION:
- Page load: staggered reveal with animation-delay (translate + opacity)
- Scroll-triggered animations using Intersection Observer API
- Smooth hover states on ALL interactive elements (scale, glow, color shift)
- CSS transitions: cubic-bezier easing curves (never linear or ease)
- Subtle parallax depth effect on hero sections
- Animated gradient backgrounds using @keyframes

LAYOUT & COMPOSITION:
- Break the grid intentionally — overlapping elements, diagonal sections
- Generous whitespace alternating with dense information zones
- Sticky header with scroll-triggered style change (transparent → solid)
- Asymmetric layouts that feel designed, not templated
- Full-bleed sections with angled/curved dividers (clip-path or SVG)

COMPONENTS TO REDESIGN:
- Navigation: floating glassmorphism bar with animated underlines
- Hero: full-viewport with layered text, animated gradient, CTA button 
  with shimmer effect
- Cards: 3D tilt effect on hover, glowing border, rich shadows
- Buttons: gradient fill, glow on hover, scale transform, ripple effect
- Sections: alternating light/dark zones, curved clip-paths between them
- Footer: rich, multi-column with gradient top border

RESPONSIVE BREAKPOINTS:
- Mobile-first approach
- xs: 320px, sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px
- Touch-friendly tap targets (min 44x44px)
- Fluid spacing using clamp() and vw/vh units
- Collapsible navigation with smooth hamburger → X animation

═══════════════════════════════════════
📐 SPECIFIC CSS TECHNIQUES TO USE
═══════════════════════════════════════

/* Mesh Gradient Background */
background: radial-gradient(at 40% 20%, hsl(VAR1) 0px, transparent 50%),
            radial-gradient(at 80% 0%, hsl(VAR2) 0px, transparent 50%),
            radial-gradient(at 0% 50%, hsl(VAR3) 0px, transparent 50%);

/* Glassmorphism Card */
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.1);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

/* Glow Effect */
box-shadow: 0 0 30px hsla(VAR_ACCENT, 0.5), 
            0 0 60px hsla(VAR_ACCENT, 0.2);

/* Fluid Typography */
font-size: clamp(2rem, 5vw + 1rem, 6rem);

/* Diagonal Section */
clip-path: polygon(0 0, 100% 0, 100% 85%, 0 100%);

/* Shimmer Button */
background: linear-gradient(90deg, color1, color2, color1);
background-size: 200% auto;
animation: shimmer 3s linear infinite;

═══════════════════════════════════════
⚡ PERFORMANCE REQUIREMENTS
═══════════════════════════════════════

- Use will-change: transform on animated elements
- Prefer CSS animations over JavaScript for simple transitions
- Lazy-load images with loading="lazy"
- Use transform and opacity for animations (GPU-accelerated)
- Avoid layout thrashing — no animating width/height/margin

═══════════════════════════════════════
🚫 STRICTLY FORBIDDEN
═══════════════════════════════════════

- Generic purple-gradient-on-white aesthetic
- Bootstrap or Material UI default styling
- Comic Sans, Arial, Roboto, or any system font
- Flat, shadowless, boring UI
- Identical card designs with no depth
- Unresponsive layouts that break on mobile
- Animations that use "linear" easing
- Any design choice that looks "AI-generated" or template-based

═══════════════════════════════════════
✅ DELIVERABLE
═══════════════════════════════════════

Redesign every component in this React project applying ALL the above.
Produce complete, production-ready code. 
The result must look like it was designed by a top-tier agency 
charging $50,000+ for the project.
Make it UNFORGETTABLE.