import { Link } from "@tanstack/react-router";
import { Mail, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-20 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-12 gap-10 md:gap-8">
        {/* Brand */}
        <div className="col-span-2 md:col-span-4">
          <Link to="/" className="font-display text-2xl font-bold italic text-primary mb-5 inline-block">
            Vohitra.
          </Link>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            La référence immobilière à Madagascar. Transparence, sécurité et proximité au service de vos projets de vie.
          </p>
        </div>

        {/* Plateforme */}
        <div className="md:col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-widest mb-5">Plateforme</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-primary transition-colors">Annonces</Link></li>
            <li><Link to="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
            <li><Link to="/tokens" className="hover:text-primary transition-colors">Acheter des jetons</Link></li>
            <li><Link to="/compare" className="hover:text-primary transition-colors">Comparateur</Link></li>
          </ul>
        </div>

        {/* Compte */}
        <div className="md:col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-widest mb-5">Compte</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-primary transition-colors">Connexion</Link></li>
            <li><Link to="/signup" className="hover:text-primary transition-colors">Inscription</Link></li>
            <li><Link to="/favorites" className="hover:text-primary transition-colors">Mes favoris</Link></li>
            <li><Link to="/alerts" className="hover:text-primary transition-colors">Mes alertes</Link></li>
          </ul>
        </div>

        {/* Légal */}
        <div className="md:col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-widest mb-5">Légal</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li><a href="#" className="hover:text-primary transition-colors">Conditions générales</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Confidentialité</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Mentions légales</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Cookies</a></li>
          </ul>
        </div>

        {/* Contact */}
        <div className="col-span-2 md:col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-widest mb-5">Contact</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="size-4 shrink-0 mt-0.5 text-primary" />
              <span>Antananarivo, Madagascar</span>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="size-4 shrink-0 mt-0.5 text-primary" />
              <a href="mailto:contact@vohitra.mg" className="hover:text-primary transition-colors break-all">
                contact@vohitra.mg
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-12 pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Vohitra Immobilier Madagascar. Tous droits réservés.</p>
        <p className="italic">Fait avec soin à Madagascar.</p>
      </div>
    </footer>
  );
}
