'use client';

import React from 'react';
import { useState } from 'react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Crown, 
  Shield, 
  Users, 
  Zap, 
  Globe, 
  Lock, 
  Trophy, 
  CheckCircle,
  Play,
  ArrowRight,
  Timer,
  Award
} from 'lucide-react';
import Link from 'next/link';

<style jsx global>{`
  .three-d {
    text-shadow:
      0 2px 4px #000a,
      0 4px 8px #0006,
      0 8px 16px #0004;
  }
`}</style>

export default function LandingPage() {
  const [isHovered, setIsHovered] = useState(false);

  const features = [
    {
      icon: Zap,
      title: "Real-time Multiplayer",
      description: "Play chess with instant move synchronization and live updates"
    },
    {
      icon: Shield,
      title: "Verus ID Authentication",
      description: "Secure, decentralized login using your Verus blockchain identity"
    },
    {
      icon: Trophy,
      title: "Tournament System",
      description: "(Coming Soon) Compete in tournaments with automatic progression"
    },
    {
      icon: Lock,
      title: "Blockchain Storage",
      description: "All games permanently stored and verified on the Verus blockchain"
    },
    {
      icon: Users,
      title: "Privacy",
      description: "No personal information is stored"
    },
    {
      icon: Globe,
      title: "Cross-platform",
      description: "Play anywhere, anytime on desktop, tablet, or mobile"
    }
  ];



  const howItWorks = [
    {
      step: "1",
      title: "Login with Verus ID",
      description: "Use your Verus blockchain identity for secure, decentralized authentication"
    },
    {
      step: "2", 
      title: "Challenge Players",
      description: "Find opponents and join games with players worldwide"
    },
    {
      step: "3",
      title: "Play Real-time Chess",
      description: "Enjoy instant move synchronization and live game updates"
    },
    {
      step: "4",
      title: "Games Stored on Blockchain",
      description: "All games permanently verified and stored on the Verus blockchain"
    }
  ];

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600">
      {/* Navigation */}
      <div className="w-full bg-blue-900 py-4 px-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-8">
          <div className="flex items-center space-x-2">
            <Crown className="h-8 w-8 text-blue-300" />
            <span className="text-2xl font-extrabold text-white three-d">Verus Chess Arena</span>
          </div>
          <div className="flex space-x-4">
            {/* <Button variant="ghost" className="text-white hover:text-blue-300">
              About
            </Button>
            <Button variant="ghost" className="text-white hover:text-blue-300">
              Features
            </Button> */}
            <Link
              href="/login"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              Play Now
              <ArrowRight className={`ml-2 h-4 w-4 transition-transform ${isHovered ? 'translate-x-1' : ''}`} />
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="text-center py-20 px-6 w-full">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Decentralized Chess on{' '}
            <span className="bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">
              Verus Blockchain
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Play chess with real-time multiplayer, tournament competition, and blockchain-verified games. 
            Experience the future of decentralized gaming.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="bg-blue-700 hover:bg-blue-600 text-white rounded-md text-lg px-8 py-4 inline-flex items-center justify-center font-medium"
            >
              <Play className="mr-2 h-5 w-5" />
              Start Playing
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-blue-400 text-blue-200 hover:bg-blue-400 hover:text-blue-900 text-lg px-8 py-4"
            >
              Watch Demo
            </Button>
          </div>
        </div>
      </section>



      {/* Features Section */}
      <section className="py-20 px-6 w-full bg-blue-900/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Choose Verus Chess?
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Experience the perfect blend of traditional chess and modern blockchain technology
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-blue-800/80 border-blue-700 hover:border-blue-400 transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-700 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-blue-100">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6 bg-blue-800 w-full">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Get started in just four simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-blue-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-white">{step.step}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-blue-100">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 w-full bg-blue-900/80">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Play?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join players worldwide and experience the future of decentralized chess gaming
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-blue-700 w-full bg-blue-950">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Crown className="h-6 w-6 text-blue-300" />
                <span className="text-xl font-extrabold text-white three-d">Verus Chess Arena</span>
              </div>
              <p className="text-blue-100">
                Decentralized chess gaming on the Verus blockchain
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-blue-100">
                <li>Features</li>
                <li>Tournaments</li>
                <li>Leaderboard</li>
                <li>API</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-blue-100">
                <li>Community</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-blue-100">
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-blue-700 mt-8 pt-8 text-center text-blue-100">
          </div>
        </div>
      </footer>
    </div>
  );
}
