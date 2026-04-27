import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Warehouse, BarChart3, Bell, ShoppingCart, Smartphone, ArrowRight, Check, Zap, Shield, RefreshCw, Cpu, ChevronRight, Play, Users, Star, Scan, Globe, Lock, Sparkles, ChevronDown, Wifi, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef, useMemo } from 'react';
const Landing = () => {
  const {
    user
  } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const [mousePosition, setMousePosition] = useState({
    x: 0,
    y: 0
  });
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setMousePosition({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height
        });
      }
    };
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  const features = [{
    icon: Warehouse,
    title: "Gestione Dispense",
    description: "Organizza i tuoi prodotti in più location con sincronizzazione real-time",
    color: "from-primary/20 to-primary/5"
  }, {
    icon: Bell,
    title: "Notifiche Intelligenti",
    description: "Ricevi avvisi quando i prodotti scendono sotto la soglia impostata",
    color: "from-warning/20 to-warning/5"
  }, {
    icon: BarChart3,
    title: "Analytics Avanzate",
    description: "Monitora consumi e trend con grafici interattivi e report dettagliati",
    color: "from-success/20 to-success/5"
  }, {
    icon: ShoppingCart,
    title: "Lista della Spesa",
    description: "Genera automaticamente la lista della spesa basata sulle scorte",
    color: "from-primary/20 to-primary/5"
  }, {
    icon: Smartphone,
    title: "App Mobile",
    description: "Accedi alle tue dispense ovunque con la nostra Progressive Web App",
    color: "from-destructive/20 to-destructive/5"
  }, {
    icon: RefreshCw,
    title: "Sync Automatico",
    description: "I dispositivi IoT aggiornano l'inventario in tempo reale",
    color: "from-success/20 to-success/5"
  }];
  const benefits = ["Zero sprechi alimentari", "Risparmio di tempo", "Gestione centralizzata", "Report automatici"];
  const stats = [{
    value: "10K+",
    label: "Utenti Attivi",
    suffix: ""
  }, {
    value: "500K+",
    label: "Prodotti Tracciati",
    suffix: ""
  }, {
    value: "30%",
    label: "Risparmio Medio",
    suffix: ""
  }, {
    value: "99.9%",
    label: "Uptime",
    suffix: ""
  }];
  const testimonials = [{
    name: "Marco R.",
    role: "Ristoratore",
    text: "PantryOS ha rivoluzionato la gestione del mio magazzino. Risparmio ore ogni settimana!",
    avatar: "M"
  }, {
    name: "Laura B.",
    role: "Famiglia",
    text: "Finalmente non butto più cibo scaduto. Le notifiche sono perfette!",
    avatar: "L"
  }, {
    name: "Giovanni T.",
    role: "Hotel Manager",
    text: "Gestire 50 dispense non è mai stato così semplice. Consiglio vivamente.",
    avatar: "G"
  }];
  const year = new Date().getFullYear();
  const particles = useMemo(() => {
    return [...Array(20)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 3}s`
    }));
  }, []);
  return <div className="min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
              <Warehouse className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">PantryOS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group">
              Chi siamo
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </Link>
            <Link to="/scanners" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group">
              Scanner
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </Link>
            <Link to="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group">
              Prezzi
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {user ? <>
                <Link to="/profilo"><Button variant="ghost" size="sm" className="px-2 sm:px-3"><User className="h-4 w-4 sm:mr-1"/><span className="hidden sm:inline">My account</span></Button></Link>
                <Link to="/dashboard"><Button size="sm" className="shadow-glow px-2 sm:px-3"><LayoutDashboard className="h-4 w-4 sm:mr-1"/><span className="hidden sm:inline">My Dashboard</span></Button></Link>
              </> : <>
                <Link to="/auth"><Button variant="ghost" size="sm">Registrati</Button></Link>
                <Link to="/auth"><Button size="sm" className="shadow-glow">Accedi</Button></Link>
              </>}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-primary/30 via-primary/10 to-transparent rounded-full blur-3xl" style={{
          transform: `translate(${mousePosition.x * 50}px, ${mousePosition.y * 50}px)`
        }} />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-success/20 via-success/5 to-transparent rounded-full blur-3xl" style={{
          transform: `translate(${-mousePosition.x * 30}px, ${-mousePosition.y * 30}px)`
        }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-radial from-primary/5 to-transparent rounded-full animate-pulse" />
        </div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          {particles.map(p => <div key={p.id} className="absolute w-2 h-2 bg-primary/30 rounded-full animate-pulse" style={{
          left: p.left,
          top: p.top,
          animationDelay: p.delay,
          animationDuration: p.duration
        }} />)}
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center mt-[40px]">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 text-sm font-medium text-primary animate-fade-in backdrop-blur-sm">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span>Gestione Inventario Intelligente</span>
                <span className="bg-primary/20 px-2 py-0.5 rounded-full text-xs">Nuovo</span>
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] animate-fade-in" style={{
              animationDelay: '0.1s'
            }}>
                Il tuo inventario,
                <span className="block mt-2 bg-gradient-to-r from-primary via-primary to-success bg-clip-text text-transparent">
                  sotto controllo.
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-xl animate-fade-in leading-relaxed" style={{
              animationDelay: '0.2s'
            }}>
                Monitora le scorte della tua casa o attività con dispositivi IoT intelligenti. 
                Ricevi notifiche, genera liste della spesa e analizza i consumi in tempo reale.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{
              animationDelay: '0.3s'
            }}>
                <Link to="/auth">
                  <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 shadow-glow hover:shadow-lg transition-all group bg-gradient-to-r from-primary to-primary/80">
                    Inizia Gratis
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/about">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 backdrop-blur-sm">
                    <Play className="mr-2 h-5 w-5" />
                    Guarda Demo
                  </Button>
                </Link>
              </div>
              
              <div style={{
              animationDelay: '0.4s'
            }} className="flex flex-wrap gap-4 pt-4 animate-fade-in mb-[30px]">
                {benefits.map((benefit, index) => <div key={index} className="flex items-center gap-2 text-muted-foreground bg-card/50 backdrop-blur-sm px-3 py-2 rounded-full border border-border/50">
                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{benefit}</span>
                  </div>)}
              </div>
            </div>

            {/* Hero visual */}
            <div className="relative hidden lg:block animate-fade-in" style={{
            animationDelay: '0.5s'
          }}>
              {/* Main card */}
              <div className="relative">
                {/* Floating cards */}
                <div className="absolute -top-8 -left-8 w-52 h-36 bg-card/80 backdrop-blur-xl border rounded-2xl shadow-2xl p-5 z-20" style={{
                animation: 'float 4s ease-in-out infinite'
              }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">145</p>
                      <p className="text-xs text-muted-foreground">Prodotti</p>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-to-r from-primary to-success rounded-full animate-pulse" />
                  </div>
                </div>

                <div className="absolute top-1/3 -right-4 w-44 h-32 bg-card/80 backdrop-blur-xl border rounded-2xl shadow-2xl p-4 z-20" style={{
                animation: 'float 5s ease-in-out infinite',
                animationDelay: '1s'
              }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <span className="text-sm font-medium">Sync OK</span>
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        <span className="text-xs text-muted-foreground">Live</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">4 dispositivi online</p>
                </div>

                <div className="absolute -bottom-4 left-1/4 w-56 h-28 bg-card/80 backdrop-blur-xl border rounded-2xl shadow-2xl p-4 z-20" style={{
                animation: 'float 4.5s ease-in-out infinite',
                animationDelay: '0.5s'
              }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Bell className="h-4 w-4 text-warning" />
                      Alert
                    </span>
                    <span className="text-xs text-warning font-medium bg-warning/10 px-2 py-1 rounded-full">3 sotto soglia</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                      <Package className="h-5 w-5 text-warning" />
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                      <Package className="h-5 w-5 text-warning" />
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                      <Package className="h-5 w-5 text-warning" />
                    </div>
                  </div>
                </div>

                {/* Main dashboard preview */}
                <div className="w-full aspect-square bg-gradient-to-br from-card via-card/80 to-card/60 rounded-3xl border shadow-2xl flex items-center justify-center overflow-hidden">
                  <div className="relative w-full h-full p-8">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-success/10" />
                    <div className="relative h-full flex flex-col">
                      {/* Mock header */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/20" />
                          <div className="h-4 w-32 bg-muted rounded" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-8 w-8 rounded-lg bg-muted" />
                          <div className="h-8 w-8 rounded-lg bg-muted" />
                        </div>
                      </div>
                      {/* Mock content */}
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 rounded-xl p-4 animate-pulse" />
                        <div className="bg-muted/50 rounded-xl p-4 animate-pulse" style={{
                        animationDelay: '0.2s'
                      }} />
                        <div className="col-span-2 bg-muted/50 rounded-xl p-4 animate-pulse" style={{
                        animationDelay: '0.4s'
                      }} />
                      </div>
                    </div>
                  </div>
                  <Warehouse className="absolute h-48 w-48 text-primary/10" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-8 w-8 text-muted-foreground" />
        </div>
      </section>

      {/* Trusted by section */}
      <section className="py-12 border-y bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-muted-foreground mb-6">Scelto da aziende e famiglie in tutta Italia</p>
          <div className="flex items-center justify-center gap-12 flex-wrap opacity-50">
            {['Ristoranti', 'Hotel', 'Supermercati', 'Famiglie', 'Magazzini'].map((item, idx) => <div key={idx} className="text-xl font-bold text-muted-foreground">{item}</div>)}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => <div key={index} className="text-center p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-colors animate-fade-in group" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <p className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent group-hover:scale-105 transition-transform inline-block">
                  {stat.value}
                </p>
                <p className="text-muted-foreground mt-2">{stat.label}</p>
              </div>)}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-background" />
        <div className="container mx-auto px-6 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 text-sm font-medium text-primary mb-6">
              <Zap className="h-4 w-4" />
              Funzionalità
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">Tutto ciò che ti serve</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Una suite completa di strumenti per gestire le tue scorte in modo intelligente
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => <div key={index} className="group relative bg-card border rounded-2xl p-8 hover:shadow-glow transition-all duration-500 hover:-translate-y-2 animate-fade-in overflow-hidden" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              </div>)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-muted/30 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-success/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-6 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 text-sm font-medium text-primary mb-6">
              <Play className="h-4 w-4" />
              Come funziona
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">Tre semplici passaggi</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Inizia in meno di 5 minuti</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[{
            step: 1,
            title: "Crea le dispense",
            desc: "Organizza i tuoi spazi di stoccaggio virtuali",
            icon: Warehouse
          }, {
            step: 2,
            title: "Collega lo scanner",
            desc: "Configura i dispositivi IoT in 30 secondi",
            icon: Scan
          }, {
            step: 3,
            title: "Scansiona e monitora",
            desc: "Traccia automaticamente le scorte in tempo reale",
            icon: BarChart3
          }].map((item, index) => <div key={index} className="text-center animate-fade-in relative" style={{
            animationDelay: `${index * 0.2}s`
          }}>
                <div className="relative inline-block mb-6">
                  <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center mx-auto shadow-glow">
                    <item.icon className="h-10 w-10" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-background border-2 border-primary flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
                {index < 2 && <ChevronRight className="hidden md:block absolute top-12 -right-4 h-8 w-8 text-primary/30" />}
              </div>)}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 text-sm font-medium text-primary mb-6">
              <Users className="h-4 w-4" />
              Testimonianze
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">Cosa dicono i nostri utenti</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => <div key={index} className="bg-card border rounded-2xl p-8 hover:shadow-glow transition-all animate-fade-in" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-primary text-primary" />)}
                </div>
                <p className="text-muted-foreground mb-6 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>)}
          </div>
        </div>
      </section>

      {/* Scanner CTA */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="aspect-square bg-gradient-to-br from-card via-card/80 to-card/60 rounded-3xl border shadow-2xl flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-success/20" />
                <Cpu className="h-32 w-32 text-primary/30" />
              </div>
              <div className="absolute -top-4 -right-4 bg-card/80 backdrop-blur-xl border rounded-xl shadow-lg p-4" style={{
              animation: 'float 3s ease-in-out infinite'
            }}>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-success animate-pulse" />
                  <span className="text-sm font-medium">Online</span>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 text-sm font-medium text-primary mb-6">
                <Cpu className="h-4 w-4" />
                Hardware
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">Scanner dedicati per la tua dispensa</h2>
              <p className="text-lg text-muted-foreground mb-8">
                I nostri dispositivi IoT sono progettati per integrarsi perfettamente con PantryOS. 
                Basta una scansione per aggiornare l'inventario.
              </p>
              <div className="space-y-4 mb-8">
                {[{
                icon: Wifi,
                text: "Connessione WiFi automatica"
              }, {
                icon: Lock,
                text: "Batteria a lunga durata"
              }, {
                icon: Zap,
                text: "Configurazione in 30 secondi"
              }].map((item, idx) => <div key={idx} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-medium">{item.text}</span>
                  </div>)}
              </div>
              <Link to="/scanners">
                <Button size="lg" className="gap-2 shadow-glow">
                  Scopri gli scanner
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-success/10 border border-primary/20 rounded-3xl p-12 lg:p-20 text-center overflow-hidden">
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-success/20 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-4 py-2 text-sm font-medium text-primary mb-6">
                <Sparkles className="h-4 w-4" />
                Inizia oggi
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold mb-4">Pronto a iniziare?</h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Unisciti a migliaia di utenti che hanno già ottimizzato la gestione delle loro scorte
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/auth">
                  <Button size="lg" className="text-lg px-10 py-6 shadow-glow group text-center">
                    Crea il tuo account gratuito
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button size="lg" variant="outline" className="text-lg px-10 py-6 backdrop-blur-sm">
                    Vedi i piani
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-16 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Warehouse className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl">PantryOS</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                La soluzione intelligente per la gestione del tuo inventario domestico e aziendale.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Prodotto</h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <Link to="/about" className="block hover:text-foreground transition-colors">Chi siamo</Link>
                <Link to="/scanners" className="block hover:text-foreground transition-colors">Scanner</Link>
                <Link to="/pricing" className="block hover:text-foreground transition-colors">Prezzi</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Risorse</h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <a href="#" className="block hover:text-foreground transition-colors">Documentazione</a>
                <a href="#" className="block hover:text-foreground transition-colors">API</a>
                <a href="#" className="block hover:text-foreground transition-colors">Blog</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legale</h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <a href="#" className="block hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="#" className="block hover:text-foreground transition-colors">Termini di Servizio</a>
                <a href="#" className="block hover:text-foreground transition-colors">Cookie Policy</a>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">© {year} PantryOS. Tutti i diritti riservati.</p>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Globe className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* CSS for float animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>;
};
export default Landing;