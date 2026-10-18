import { useAccountTranslation } from '../i18n/use-account-translation';

export default function ProfilePage() {
  const t = useAccountTranslation();

  return (
    <section>
      <h3>{t('profile.title')}</h3>
      <p>{t('profile.name', { name: 'Demo Buyer' })}</p>
      <p>{t('profile.email', { email: 'buyer@example.com' })}</p>
    </section>
  );
}
