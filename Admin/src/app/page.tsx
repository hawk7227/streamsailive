'use client'

// =====================================================
// FILE ENGINE - LANDING PAGE
// Enterprise-grade marketing page
// =====================================================

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { brand, BRAND_NAME } from '@/lib/brand'
import {
  Sparkles,
  Zap,
  Shield,
  Code,
  CheckCircle,
  ArrowRight,
  Play,
  Star,
  Users,
  Clock,
  Cpu,
  Lock,
  Globe,
  ChevronDown,
  Menu,
  X,
  Github,
  Twitter
} from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [typedText, setTypedText] = useState('')

  const typingExamples = [
    'Create a dashboard with charts and analytics...',
    'Build a REST API with authentication...',
    'Design a landing page with hero section...',
    'Generate a checkout flow with Stripe...'
  ]

  // Typing animation
  useEffect(() => {
    let currentExample = 0
    let currentChar = 0
    let isDeleting = false
    let timeoutId: NodeJS.Timeout
    
    const type = () => {
      const example = typingExamples[currentExample]
      
      if (!isDeleting) {
        setTypedText(example.slice(0, currentChar + 1))
        currentChar++
        
        if (currentChar === example.length) {
          isDeleting = true
          timeoutId = setTimeout(type, 2000)
          return
        }
      } else {
        setTypedText(example.slice(0, currentChar - 1))
        currentChar--
        
        if (currentChar === 0) {
          isDeleting = false
          currentExample = (currentExample + 1) % typingExamples.length
        }
      }
      
      timeoutId = setTimeout(type, isDeleting ? 30 : 50)
    }
    
    timeoutId = setTimeout(type, 1000)
    return () => clearTimeout(timeoutId)
  }, [])

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Agentic AI — Not Just Chat',
      description: '10+ tools: create files, edit code, run commands, search the web, deploy — all in one conversation.',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Dual-Provider Failover',
      description: 'Powered by the best AI models with automatic failover. Zero downtime when providers go down.',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: <Cpu className="w-6 h-6" />,
      title: 'Media Generation Built In',
      description: 'Generate video, audio, voice, and 3D alongside your code. No other AI coding tool can do this.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'One-Click Deploy',
      description: 'From prompt to production in minutes. Deploy to Vercel, download ZIP, or push to GitHub.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: <Code className="w-6 h-6" />,
      title: 'Smart Model Routing',
      description: 'Auto-selects the best AI model for each task. Fast for chat, powerful for code, premium for complexity.',
      color: 'from-pink-500 to-rose-500'
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: 'Vision + Web Search',
      description: 'Upload screenshots for pixel-perfect recreations. Search the web and GitHub for code references.',
      color: 'from-cyan-500 to-blue-500'
    }
  ]

  const useCases = [
    { title: 'Full-Stack Apps', description: 'Complete web applications with frontend, backend, and database', image: '🚀' },
    { title: 'Landing Pages', description: 'Beautiful, responsive marketing pages deployed in minutes', image: '🎨' },
    { title: 'Dashboards', description: 'Admin panels with real-time charts, tables, and auth', image: '📊' },
    { title: 'APIs + Backends', description: 'REST/GraphQL APIs with authentication and validation', image: '🔌' },
    { title: 'Media Content', description: 'AI-generated videos, audio, voice, and 3D assets', image: '🎬' },
    { title: 'Mobile-Ready UIs', description: 'Responsive React components that work on every device', image: '📱' }
  ]

  const competitors = [
    { name: 'Salesforce Einstein', price: '$175-$550/user/mo', monthly: '$2,100-$6,600/yr per user', lacks: ['Requires base CRM license first', 'AI add-ons cost $50-$125 extra', '$75K-$150K implementation fees', 'Only works inside Salesforce', '6-month deployment timeline'] },
    { name: 'Microsoft 365 Copilot', price: '$30/user/mo + base license', monthly: '$66-$90/user/mo total', lacks: ['Requires $36-$57 base M365 license', 'Locked to Microsoft ecosystem', 'No code execution or deployment', 'No media generation', 'Pay-as-you-go agents cost extra'] },
    { name: 'ServiceNow AI', price: '$100-$300/user/mo', monthly: '$1,200-$3,600/yr per user', lacks: ['No public pricing (custom quotes only)', 'Requires 6-month implementation', 'ITSM-only, not general purpose', 'Needs dedicated admin team', 'Enterprise sales process required'] },
    { name: 'GitHub Copilot Enterprise', price: '$39/user/mo + GitHub license', monthly: '$60/user/mo total stack', lacks: ['Code autocomplete only — no deployment', 'Requires VS Code or IDE setup', 'No file creation or project building', 'No media generation', '$0.04/overage per premium request'] },
    { name: 'AWS Bedrock / Azure AI Studio', price: '$0.01-$0.08 per 1K tokens', monthly: '$500-$10,000+/mo typical', lacks: ['Pure API — no user interface', 'Requires engineering team to build', '$10K-$100K+ development cost', 'No built-in deployment pipeline', 'Unpredictable usage-based billing'] },
    { name: 'Custom AI Development', price: '$25K-$300K project', monthly: '$2,000-$20,000/mo ongoing', lacks: ['3-6 month build timeline', '$10K-$50K implementation services', 'Requires dedicated dev team', 'Ongoing maintenance costs', 'No instant iteration or updates'] },
  ]

  const testimonials = [
    { name: 'Sarah Chen', role: 'CTO at TechStart', content: `${BRAND_NAME} cut our development time by 70%. The code quality is production-ready from day one.`, avatar: 'SC' },
    { name: 'Marcus Johnson', role: 'Senior Developer', content: `Finally, an AI tool that understands what production code should look like. No more fixing AI mistakes.`, avatar: 'MJ' },
    { name: 'Emily Rodriguez', role: 'Founder at DevAgency', content: `We deliver client projects 3x faster now. ${BRAND_NAME} is a game changer for agencies.`, avatar: 'ER' }
  ]

  const pricingPlans = [
    { name: 'Free', price: '$0', period: 'forever', description: `Try ${BRAND_NAME} free`, features: ['10 generations/day', 'Fast + Pro models', '3 concurrent builds', 'Basic validation'], cta: 'Get Started', popular: false },
    { name: 'Starter', price: '$9', period: '/month', description: 'Personal projects', features: ['50 generations/day', '20 Pro + 2 Premium/day', 'Private projects', 'Standard validation'], cta: 'Start Building', popular: false },
    { name: 'Pro', price: '$19', period: '/month', description: 'Professional developers', features: ['200 generations/day', '60 Pro + 5 Premium/day', 'Priority queue', 'Deployment + API access', '5 team members'], cta: 'Start Pro Trial', popular: true },
    { name: 'Max', price: '$49', period: '/month', description: 'Power users & teams', features: ['500 generations/day', '100 Pro + 15 Premium/day', 'All Pro features', '10 team members', 'Custom model config'], cta: 'Go Max', popular: false },
    { name: 'Enterprise', price: '$149', period: '/month', description: 'Organizations at scale', features: ['1,000 generations/day', '150 Pro + 25 Premium/day', 'Unlimited team members', 'SSO/SAML + SLA', 'Dedicated support'], cta: 'Contact Sales', popular: false }
  ]

  const faqs = [
    { question: `What makes ${BRAND_NAME} different from ChatGPT or Claude?`, answer: `${BRAND_NAME} is an agentic platform — not just a chatbot. Our AI creates files, edits code, runs commands, searches the web, generates media (video/audio/3D), and deploys to production. ChatGPT and Claude can only talk about code. We actually build it.` },
    { question: 'What AI models power the platform?', answer: `We use a dual-provider system with automatic failover and smart model routing. Simple questions get instant responses from fast models. Code generation uses powerful models. You choose your tier: Fast, Pro, or Premium — we handle the rest.` },
    { question: 'What programming languages and frameworks do you support?', answer: 'All major languages and frameworks: React, Next.js, Vue, Angular, Node.js, Python, TypeScript, and more. Our AI adapts to your preferred stack and coding style.' },
    { question: 'Is my code private and secure?', answer: 'Yes. On paid plans, all your code is private. We never use your code to train AI models. Enterprise plans include SSO, audit logs, and SLA guarantees.' },
    { question: 'What happens when I hit my daily limit?', answer: 'You can still use the platform — requests automatically route to our fast-tier model which provides instant responses. Upgrade anytime for more Pro and Premium model access.' },
    { question: 'Can I cancel my subscription anytime?', answer: 'Absolutely. Cancel anytime with no questions asked. Access continues until the end of your billing period.' }
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white">{brand.logo.emoji || <Sparkles className="w-5 h-5" />}</span>
              </div>
              <span className="text-xl font-bold">{BRAND_NAME}</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-zinc-400 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-zinc-400 hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="text-zinc-400 hover:text-white transition-colors">FAQ</a>
              <Link href="/auth/login" className="text-zinc-400 hover:text-white transition-colors">Login</Link>
              <Link href="/auth/signup" className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-opacity">
                Get Started Free
              </Link>
            </div>

            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-zinc-950">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-zinc-400 hover:text-white">Features</a>
              <a href="#pricing" className="block text-zinc-400 hover:text-white">Pricing</a>
              <a href="#faq" className="block text-zinc-400 hover:text-white">FAQ</a>
              <Link href="/auth/login" className="block text-zinc-400 hover:text-white">Login</Link>
              <Link href="/auth/signup" className="block w-full text-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-medium">
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800/50 rounded-full border border-zinc-700 mb-8">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-zinc-300">Not just a chatbot — an agentic builder</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Describe it. Build it.
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Deploy it.
              </span>
            </h1>

            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
              The AI platform that actually ships code — not just talks about it. 
              10+ agentic tools, dual-provider AI, media generation, and one-click deploy.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/auth/signup" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Start Building Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#demo" className="w-full sm:w-auto px-8 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                Watch Demo
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-zinc-400">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'].map((bg, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-zinc-950`} />
                  ))}
                </div>
                <span>10,000+ developers</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                ))}
                <span className="ml-2">4.9/5 rating</span>
              </div>
            </div>
          </div>

          {/* Demo Preview */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800/50 border-b border-zinc-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 bg-zinc-900 rounded text-sm text-zinc-400">app.{brand.domain}</div>
                </div>
              </div>
              
              <div className="p-6 h-96 flex">
                <div className="w-64 bg-zinc-800/30 rounded-lg p-4 mr-4">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600" />
                    <span className="font-semibold">{BRAND_NAME}</span>
                  </div>
                  <div className="space-y-2">
                    {['New Chat', 'Dashboard', 'My Projects'].map((item, i) => (
                      <div key={i} className={`px-3 py-2 rounded-lg ${i === 0 ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'} cursor-pointer`}>{item}</div>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-2xl font-semibold mb-4">What do you want to build?</h3>
                      <div className="bg-zinc-800 rounded-xl p-4 max-w-lg">
                        <div className="text-left text-zinc-300 min-h-[60px]">
                          {typedText}
                          <span className="animate-pulse">|</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything your AI tool is missing</h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">ChatGPT talks. Cursor edits. We build, deploy, and generate media — all in one.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="p-6 bg-zinc-800/50 rounded-2xl border border-zinc-700 hover:border-zinc-600 transition-colors">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Validation Highlight */}
          <div className="mt-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl border border-zinc-700 p-8 lg:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-3xl font-bold mb-4">10-Layer Validation System</h3>
                <p className="text-zinc-400 mb-6">
                  Every piece of code passes through our comprehensive validation pipeline before you see it. No more debugging AI mistakes.
                </p>
                <div className="space-y-3">
                  {['Syntax & Parsing Validation', 'TypeScript Type Checking', 'Import & Dependency Resolution', 'React Hooks Rules', 'Security Vulnerability Scan', 'Best Practices & Linting', 'Accessibility Checks', 'Performance Analysis', 'Auto-Fix Engine', 'AI-Powered Error Correction'].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-xl p-6 font-mono text-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-green-400">All checks passed</span>
                </div>
                <div className="space-y-2 text-zinc-400">
                  <div>✓ Syntax valid</div>
                  <div>✓ Types correct</div>
                  <div>✓ Imports resolved</div>
                  <div>✓ React rules followed</div>
                  <div>✓ No security issues</div>
                  <div>✓ Best practices met</div>
                  <div className="pt-4 text-green-400">→ Code ready for production</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Build anything</h2>
            <p className="text-xl text-zinc-400">From simple components to full applications</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((useCase, index) => (
              <div key={index} className="p-6 bg-zinc-800/50 rounded-2xl border border-zinc-700 hover:border-zinc-600 transition-all hover:-translate-y-1">
                <div className="text-5xl mb-4">{useCase.image}</div>
                <h3 className="text-xl font-semibold mb-2">{useCase.title}</h3>
                <p className="text-zinc-400">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitor Comparison */}
      <section className="py-20 px-4 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Enterprise AI costs thousands. We cost $19.</h2>
            <p className="text-xl text-zinc-400">Companies pay 10x-100x more for less functionality. Here&apos;s what they&apos;re actually charging.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitors.map((comp, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-zinc-300">{comp.name}</h3>
                </div>
                <div className="text-red-400 font-bold text-sm mb-1">{comp.price}</div>
                <div className="text-xs text-zinc-500 mb-4">{comp.monthly}</div>
                <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider font-semibold">What you&apos;re paying for:</p>
                <ul className="space-y-2">
                  {comp.lacks.map((lack, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-zinc-400">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                      <span>{lack}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 bg-zinc-900 border border-emerald-700/50 rounded-xl px-8 py-5">
              <span className="text-3xl">⚡</span>
              <div className="text-left">
                <div className="text-lg font-bold text-white">{BRAND_NAME} Pro: $19/mo — everything included</div>
                <div className="text-sm text-zinc-400">Agentic AI • Code execution • One-click deploy • Media generation • Vision analysis • Dual-provider failover • No implementation fees</div>
                <div className="text-xs text-emerald-400 mt-1 font-semibold">That&apos;s 10x-100x less than the enterprise tools above — with more features.</div>
              </div>
              <Link href="/auth/signup" className="ml-4 bg-emerald-500 text-black font-bold px-5 py-3 rounded-lg text-sm hover:bg-emerald-400 transition-colors whitespace-nowrap">
                Start Free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Loved by developers</h2>
            <p className="text-xl text-zinc-400">See what our users are saying</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="p-6 bg-zinc-800/50 rounded-2xl border border-zinc-700">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-zinc-300 mb-6">&quot;{testimonial.content}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-zinc-400">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-xl text-zinc-400">Start free, upgrade when you need more</p>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div key={index} className={`p-8 rounded-2xl border ${plan.popular ? 'bg-gradient-to-b from-blue-500/10 to-purple-500/10 border-blue-500/50' : 'bg-zinc-800/50 border-zinc-700'} relative`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-zinc-400">/{plan.period}</span>
                  </div>
                  <p className="text-zinc-400 mt-2">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={plan.name === 'Enterprise' ? '/contact' : '/auth/signup'} className={`block w-full py-3 rounded-xl font-semibold text-center transition-colors ${plan.popular ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:opacity-90' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 bg-zinc-900/50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Frequently asked questions</h2>
            <p className="text-xl text-zinc-400">Everything you need to know</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details key={index} className="group bg-zinc-800/50 rounded-xl border border-zinc-700">
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <span className="font-semibold pr-4">{faq.question}</span>
                  <ChevronDown className="w-5 h-5 text-zinc-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-6 text-zinc-400">{faq.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to build faster?</h2>
          <p className="text-xl text-zinc-400 mb-8">Join 10,000+ developers shipping production code with {BRAND_NAME}.</p>
          <Link href="/auth/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity">
            Start Building Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-zinc-400">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white">{brand.logo.emoji || <Sparkles className="w-5 h-5" />}</span>
                </div>
                <span className="text-xl font-bold">{BRAND_NAME}</span>
              </div>
              <p className="text-zinc-400 text-sm">{brand.description}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-zinc-400">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><Link href="/changelog" className="hover:text-white">Changelog</Link></li>
                <li><Link href="/docs" className="hover:text-white">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-zinc-400">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-zinc-400">
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                <li><Link href="/security" className="hover:text-white">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-zinc-800">
            <p className="text-zinc-400 text-sm">© {new Date().getFullYear()} {brand.legal.companyFull}. All rights reserved.</p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <a href={brand.links.twitter} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white"><Twitter className="w-5 h-5" /></a>
              <a href={brand.links.github} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white"><Github className="w-5 h-5" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
