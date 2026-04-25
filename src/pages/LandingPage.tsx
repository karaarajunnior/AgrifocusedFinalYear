import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  TrendingUp,
  Shield,
  Leaf,
  Truck,
  Star,
  CheckCircle,
  ShoppingCart,
  Zap,
  Navigation,
  ExternalLink,
  Award,
  Users,
  Trophy,
  Globe,
  Mic,
  MapPin
} from 'lucide-react';

function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-green-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
            <div className="mb-12 lg:mb-0">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                Connecting Farmers
                <span className="text-green-600"> Directly </span>
                to Markets
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Eliminate middlemen, increase profits, and access quality coffee directly from farmers or supermarkets.
                Our decentralized platform offers local and international market filters, map-based traceability, and a global voice interface for a seamless agricultural experience.
              </p>

              <div className="flex flex-col sm:flex-row gap-6">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-10 py-5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 hover:shadow-emerald-500/20"
                >
                  Initiate Account
                  <ArrowRight className="ml-3 h-4 w-4" />
                </Link>
                <Link
                  to="/marketplace"
                  className="inline-flex items-center justify-center px-10 py-5 border-2 border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                >
                  Market Access
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-8">
                <div className="text-center group">
                  <div className="text-3xl font-bold text-green-600 group-hover:scale-110 transition-transform">5K+</div>
                  <div className="text-sm text-gray-600 font-bold uppercase tracking-widest text-[10px] mt-1">Active Farmers</div>
                </div>
                <div className="text-center group border-x border-gray-100">
                  <div className="text-3xl font-bold text-blue-600 group-hover:scale-110 transition-transform">500+</div>
                  <div className="text-sm text-gray-600 font-bold uppercase tracking-widest text-[10px] mt-1">Global Buyers</div>
                </div>
                <div className="text-center group">
                  <div className="text-3xl font-bold text-emerald-600 group-hover:scale-110 transition-transform">UGX 2M+</div>
                  <div className="text-sm text-gray-600 font-bold uppercase tracking-widest text-[10px] mt-1">Middleman Savings</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <img
                src="https://images.pexels.com/photos/1427541/pexels-photo-1427541.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Fresh vegetables and fruits"
                className="rounded-2xl shadow-2xl w-full"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-lg p-4 shadow-xl border">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">117% Higher Profits</div>
                    <div className="text-sm text-gray-600">for farmers on average</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Global Export Flow Section */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <Globe className="h-64 w-64" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">
              Real-Time <span className="text-emerald-400">Global Export</span> Flow
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Connecting rural Uganda to the rest of the world. See our verified trade routes live.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="bg-slate-800 rounded-[3rem] p-8 border border-slate-700 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-12">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Navigation className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Trade Hub</p>
                      <h4 className="text-xl font-black">Kampala Export Terminal</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active Connection
                  </div>
                </div>

                <div className="space-y-6">
                  {[
                    { country: 'United States', city: 'Seattle, WA', status: 'In Transit', progress: '65%', icon: '🇺🇸' },
                    { country: 'Germany', city: 'Hamburg Port', status: 'Export Clearance', progress: '92%', icon: '🇩🇪' },
                    { country: 'United Arab Emirates', city: 'Dubai DMCC', status: 'Completed', progress: '100%', icon: '🇦🇪' }
                  ].map((route, i) => (
                    <div key={i} className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700/50 hover:border-emerald-500/50 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-4">
                          <span className="text-3xl">{route.icon}</span>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{route.country}</p>
                            <h5 className="font-bold text-lg">{route.city}</h5>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${route.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {route.status}
                        </span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: route.progress }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-12">
              <div className="glass-card !bg-white/5 !border-white/10 p-10">
                <Zap className="h-10 w-10 text-emerald-400 mb-6" />
                <h3 className="text-2xl font-black uppercase tracking-tight mb-4">Direct Roaster Access</h3>
                <p className="text-slate-400 leading-relaxed text-lg italic mb-8">
                  "Our goal is to ensure that a roaster in California can buy from a farmer in Mbale as easily as buying from a local shop. Zero middlemen, maximum transparency."
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-3xl font-black text-white">400+</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Verified Roasters</p>
                  </div>
                  <div className="border-l border-white/10 pl-6">
                    <p className="text-3xl font-black text-emerald-400">14</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Export Nodes</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register" className="flex-1 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest text-center transition-all shadow-xl shadow-emerald-600/20">
                  List Your Harvest Globally
                </Link>
                <button className="flex-1 py-5 border-2 border-white/10 hover:border-white/30 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                  <ExternalLink className="h-4 w-4" /> Global Importer Portal
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose DAFIS?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform combines cutting-edge technology with agricultural expertise to create
              a transparent, efficient, and profitable marketplace for everyone.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Globe className="h-8 w-8 text-blue-600" />}
              title="GLOBAL & LOCAL"
              description="Filter products based on local or international origin to find exactly what your market needs."
            />

            <FeatureCard
              icon={<Mic className="h-8 w-8 text-emerald-600" />}
              title="VOICE INTERFACE"
              description="Navigate the entire platform using just your voice. Perfect for hands-free field use."
            />

            <FeatureCard
              icon={<MapPin className="h-8 w-8 text-purple-600" />}
              title="TRUE TRACEABILITY"
              description="Trace every batch back to its origin farm with our immutable ledger and visual journey maps."
            />

            <FeatureCard
              icon={<ShoppingCart className="h-8 w-8 text-orange-600" />}
              title="SUPERMARKET HUB"
              description="Integrated supermarkets selling premium processed goods alongside fresh farm produce."
            />

            <FeatureCard
              icon={<Truck className="h-8 w-8 text-rose-600" />}
              title="PRECISION LOGISTICS"
              description="Real-time truck tracking and route optimization for guaranteed supply chain integrity."
            />

            <FeatureCard
              icon={<Shield className="h-8 w-8 text-teal-600" />}
              title="IMMUTABLE SECURITY"
              description="Tamper-proof transaction records providing institutional-grade security for all participants."
            />
          </div>
        </div>
      </section>


      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Simple steps to connect, transact, and grow your agricultural business
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              step="1"
              title="Register & Verify"
              description="Create your account as a farmer or buyer. Complete verification to build trust in the community."
              image="https://images.pexels.com/photos/5816287/pexels-photo-5816287.jpeg?auto=compress&cs=tinysrgb&w=400"
            />

            <StepCard
              step="2"
              title="List or Browse"
              description="Farmers list their fresh produce with prices and details. Buyers browse and find the best deals."
              image="https://images.pexels.com/photos/1300972/pexels-photo-1300972.jpeg?auto=compress&cs=tinysrgb&w=400"
            />

            <StepCard
              step="3"
              title="Connect & Trade"
              description="Direct communication, secure transactions, and transparent delivery tracking for successful trades."
              image="https://images.pexels.com/photos/3943723/pexels-photo-3943723.jpeg?auto=compress&cs=tinysrgb&w=400"
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What Our Users Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard
              name="Nakato Sarah"
              role="Coffee Farmer, Jinja"
              content="DAFIS has transformed my farming business. I now get much better prices by selling directly to buyers without middlemen taking most of my earnings."
              rating={5}
              avatar="https://images.pexels.com/photos/6457579/pexels-photo-6457579.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"
            />

            <TestimonialCard
              name="Ochieng David"
              role="Coffee Buyer, Kampala"
              content="The quality of coffee is verified and prices are transparent. I can trace exactly where my coffee comes from and the logistics coordination saves me time."
              rating={5}
              avatar="https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"
            />

            <TestimonialCard
              name="Namugwanya Grace"
              role="Cooperative Leader, Mbale"
              content="The price insights help our cooperative members make better decisions. The platform is transparent and our members now earn what they deserve."
              rating={5}
              avatar="https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"
            />
          </div>
        </div>
      </section>

      {/* Global Roaster's Corner Section */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-6">
                <Award className="h-3 w-3" /> Global Discovery Hub
              </div>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-slate-900 mb-4">
                Global <span className="text-blue-600">Roaster's</span> Corner
              </h2>
              <p className="text-xl text-slate-500 font-medium leading-relaxed">
                Exclusive portal for international bulk buyers to discover verified, export-grade harvests with full traceability.
              </p>
            </div>
            <Link to="/marketplace?origin=INTERNATIONAL" className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10">
              Explore Global Inventory
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { name: "Premium Bugisu Arabica", grade: "AA", region: "Mbale, Mt. Elgon", quantity: "25 Tons", roaster: "Direct Trade" },
              { name: "Single Origin Robusta", grade: "Fine", region: "Masaka Highlands", quantity: "18 Tons", roaster: "Heritage Batch" },
              { name: "High-Altitude Honey Process", grade: "Micro-lot", region: "Kapchorwa", quantity: "2 Tons", roaster: "Specialty Only" }
            ].map((crop, i) => (
              <div key={i} className="glass-card overflow-hidden group hover:translate-y-[-8px] transition-all border-blue-50">
                <div className="h-48 bg-slate-100 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-emerald-500/10" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:scale-110 transition-transform">
                    <Leaf className="h-32 w-32" />
                  </div>
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-blue-600 shadow-sm">
                    Verified {crop.grade} Grade
                  </div>
                </div>
                <div className="p-8">
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{crop.name}</h4>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                    <MapPin className="h-3 w-3" /> {crop.region}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Available</p>
                      <p className="font-bold text-slate-900">{crop.quantity}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Class</p>
                      <p className="font-bold text-blue-600">{crop.roaster}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Leaderboard Section */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-slate-900 mb-4">
              Market <span className="text-emerald-600">Impact</span> Leaderboard
            </h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
              Real-time social proof of the direct trade revolution.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="glass-card p-10 bg-slate-900 text-white border-0 shadow-2xl relative">
              <div className="absolute top-6 right-6">
                <Trophy className="h-10 w-10 text-amber-400 opacity-20" />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Savings Counter</p>
              <h3 className="text-5xl font-black text-emerald-400 mb-6 tracking-tighter">UGX 2.4M+</h3>
              <p className="text-slate-400 leading-relaxed font-bold italic">
                Saved from middlemen commissions this month alone. Directly into the pockets of Ugandan farmers.
              </p>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Top Export Nodes (This Week)</h4>
              {[
                { node: "Mbale Central -> Global Roasters (USA)", volume: "12.4 Tons", impact: "+18% Farmer Profit" },
                { node: "Kapchorwa Specialty -> Hamburg Port", volume: "4.2 Tons", impact: "+24% Farmer Profit" },
                { node: "Southwestern Cooperative -> Dubai DMCC", volume: "8.1 Tons", impact: "+15% Farmer Profit" }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-100 group hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-xs text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all shadow-sm">
                      0{i+1}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 tracking-tight">{item.node}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{item.impact}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-900">{item.volume}</p>
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Verified Trade</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Referral/Viral Section */}
      <section className="py-24 relative overflow-hidden bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-gradient-to-br from-emerald-600 to-blue-700 rounded-[4rem] p-12 md:p-20 text-center text-white shadow-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 max-w-3xl mx-auto">
              <Users className="h-16 w-16 mx-auto mb-8 text-white opacity-20" />
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-8">
                Build the <span className="text-emerald-300">Viral</span> Network
              </h2>
              <p className="text-xl text-emerald-50 font-medium leading-relaxed mb-12">
                Refer a fellow farmer or a global importer and unlock exclusive "Trade Pioneer" badges and reduced transaction fees.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Link to="/register" className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all">
                  Join as Pioneer
                </Link>
                <button className="px-10 py-5 border-2 border-white/20 hover:border-white/50 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white transition-all">
                  Learn About Rewards
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-green-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Join the Agricultural Revolution?
          </h2>
          <p className="text-xl text-green-100 mb-8 max-w-3xl mx-auto">
            Whether you're a farmer looking to maximize profits or a buyer seeking quality
            coffee at fair prices, DAFIS is your solution.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-10 py-5 bg-white text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-emerald-50 transition-all shadow-xl"
            >
              Start Selling
              <Leaf className="ml-3 h-4 w-4 text-emerald-600" />
            </Link>
            <Link
              to="/marketplace"
              className="inline-flex items-center justify-center px-10 py-5 border-2 border-white text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-white hover:text-emerald-600 transition-all"
            >
              Browse Global Market
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// Helper Components
function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card p-10 group hover:translate-y-[-4px] transition-all border-slate-100/30">
      <div className="mb-6 bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight uppercase">{title}</h3>
      <p className="text-slate-500 font-medium leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description, image }: {
  step: string;
  title: string;
  description: string;
  image: string;
}) {
  return (
    <div className="text-center">
      <div className="relative mb-6">
        <img src={image} alt={title} className="w-full h-48 object-cover rounded-xl" />
        <div className="absolute -top-4 -right-4 w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
          {step}
        </div>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function TestimonialCard({ name, role, content, rating, avatar }: {
  name: string;
  role: string;
  content: string;
  rating: number;
  avatar: string;
}) {
  return (
    <div className="bg-gray-50 p-8 rounded-xl">
      <div className="flex items-center mb-4">
        {[...Array(rating)].map((_, i) => (
          <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
        ))}
      </div>
      <p className="text-gray-700 mb-6 leading-relaxed">"{content}"</p>
      <div className="flex items-center">
        <img src={avatar} alt={name} className="w-12 h-12 rounded-full mr-4" />
        <div>
          <div className="font-semibold text-gray-900">{name}</div>
          <div className="text-sm text-gray-600">{role}</div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;