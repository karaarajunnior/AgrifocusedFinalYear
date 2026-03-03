import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Users,
  TrendingUp,
  Shield,
  Leaf,
  BarChart3,
  Truck,
  Star,
  CheckCircle,
  Globe
} from 'lucide-react';
import ProfitMaximizer from '../components/ProfitMaximizer';

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
                Eliminate middlemen, increase profits, and access quality coffee directly from farmers.
                Our decentralized platform ensures fair prices and transparent transactions for Uganda's coffee sector.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Get Started Today
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/marketplace"
                  className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Browse Marketplace
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">5K+</div>
                  <div className="text-sm text-gray-600">Active Farmers</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">500+</div>
                  <div className="text-sm text-gray-600">Buyers</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">UGX 2B+</div>
                  <div className="text-sm text-gray-600">Transactions</div>
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
              icon={<Users className="h-8 w-8 text-blue-600" />}
              title="Direct Connection"
              description="Connect farmers directly with buyers, eliminating unnecessary middlemen and reducing costs."
            />

            <FeatureCard
              icon={<BarChart3 className="h-8 w-8 text-green-600" />}
              title="Market Price Transparency"
              description="Access real-time market prices and demand data to make informed selling decisions and get fair value."
            />

            <FeatureCard
              icon={<Shield className="h-8 w-8 text-purple-600" />}
              title="Blockchain Security"
              description="Transparent and tamper-proof transactions recorded on our decentralized blockchain network."
            />

            <FeatureCard
              icon={<Truck className="h-8 w-8 text-orange-600" />}
              title="Smart Logistics"
              description="Efficient delivery tracking and logistics optimization to ensure fresh produce reaches buyers."
            />

            <FeatureCard
              icon={<TrendingUp className="h-8 w-8 text-red-600" />}
              title="Market Analytics"
              description="Comprehensive dashboards with insights on pricing trends, demand patterns, and market opportunities."
            />

            <FeatureCard
              icon={<CheckCircle className="h-8 w-8 text-teal-600" />}
              title="Quality Assurance"
              description="Verified farmers, quality guarantees, and transparent rating systems for trust and reliability."
            />
          </div>
        </div>
      </section>

      {/* Profit Proof Section */}
      <section className="py-20 bg-gray-50 border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12 items-center">
            <div className="lg:col-span-1">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-bold mb-6">
                <Globe className="h-4 w-4 mr-2" />
                Verified Results
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 leading-tight">
                Mathematically Proven <span className="text-green-600">Profit Gains</span>
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                We don't just promise better prices—we prove it. Our analytics engine compares real-time local middleman rates against direct export contracts to maximize your harvest's value.
              </p>
              <ul className="space-y-4">
                {[
                  'Eliminate 40%+ middleman markups',
                  'Direct access to Kampala & Regional hubs',
                  'Export-ready contracts for verified farmers'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-gray-700 font-medium">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-2">
              <ProfitMaximizer />
            </div>
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

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-green-600 font-bold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Start Selling Today
              <Leaf className="ml-2 h-5 w-5" />
            </Link>
            <Link
              to="/marketplace"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-white font-bold rounded-lg hover:bg-white hover:text-green-600 transition-colors"
            >
              Browse Products
              <ArrowRight className="ml-2 h-5 w-5" />
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
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
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