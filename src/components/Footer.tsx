import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Footer() {
  const { health } = useAuth();

  return (
    <footer className="bg-navy-950 text-slate-300 border-t border-navy-800">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <p className="font-display text-lg font-bold text-white">FixMate</p>
          <p className="text-sm text-slate-400 mt-2 max-w-md leading-relaxed">
            Find. Fix. Feel Better. Connecting homeowners with verified local electricians,
            plumbers, HVAC technicians, and appliance repair specialists with transparent quotations.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-white mb-3">Platform</p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link to="/explore" className="hover:text-white transition-colors">Explore Services</Link></li>
            <li><Link to="/ai-assistant" className="hover:text-white transition-colors">AI Repair Assistant</Link></li>
            <li><Link to="/register" className="hover:text-white transition-colors">Become a Service Pro</Link></li>
            <li><Link to="/login" className="hover:text-white transition-colors">Sign In</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold text-white mb-3">Standards & Trust</p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>Verified Local Specialists</li>
            <li>Customer-Approved Quotations</li>
            <li>Razorpay Verified Checkout</li>
            <li>OpenStreetMap Location Discovery</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-navy-800">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} FixMate Home Services Platform. All rights reserved.</span>
          {health && !health.dbConnected && (
            <span className="text-amber-300">
              Setup required: Configure MONGODB_URI in Settings &gt; Secrets to enable live persistence.
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
