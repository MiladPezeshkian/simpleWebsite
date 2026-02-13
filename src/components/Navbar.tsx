import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, GraduationCap, Globe } from 'lucide-react';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const toggleLang = () => {
    const newLang = i18n.language === 'en' ? 'fa' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('lang', newLang);
    document.documentElement.dir = newLang === 'fa' ? 'rtl' : 'ltr';
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8" />
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold leading-tight">{t('app.title')}</h1>
            <p className="text-xs opacity-80">{t('app.subtitle')}</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleLang} className="text-primary-foreground hover:bg-primary-foreground/10">
            <Globe className="h-4 w-4 me-1" />
            {t('nav.language')}
          </Button>
          {profile && (
            <span className="hidden md:inline text-sm opacity-90">{profile.name}</span>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="h-4 w-4 me-1" />
            {t('nav.logout')}
          </Button>
        </div>
      </div>
    </header>
  );
}
