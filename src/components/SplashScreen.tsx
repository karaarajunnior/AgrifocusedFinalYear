import { Leaf } from 'lucide-react';

function SplashScreen() {
  return (
    <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center animate-pulse">
      <div className="text-white flex flex-col items-center">
        <Leaf className="h-24 w-24 mb-6" />
        <h1 className="text-6xl font-extrabold tracking-widest text-white shadow-sm">
          DAFIS
        </h1>
        <p className="mt-4 text-green-100 text-xl font-medium tracking-wide">
          AgriConnect Platform
        </p>
      </div>
      <div className="absolute bottom-10 flex space-x-2">
        <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
      </div>
    </div>
  );
}

export default SplashScreen;
