import { usePreferences } from '../preferences/context'

export default function MemberSteps({ step }) {
  const { t } = usePreferences()
  return <ol className="member-steps" aria-label={t('Các bước đăng ký')}>
    {['Tạo tài khoản', 'Chọn gói tập', 'Đăng ký lớp'].map((label, i) => <li key={label} className={i + 1 <= step ? 'reached' : ''} aria-current={i + 1 === step ? 'step' : undefined}><span>{i + 1 < step ? '✓' : `0${i + 1}`}</span>{t(label)}</li>)}
  </ol>
}
