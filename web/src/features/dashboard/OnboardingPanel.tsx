import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { NodeFormModal } from '@/features/nodes/NodeFormModal';
import styles from './widgets.module.css';

/**
 * First-run guidance: shown when no nodes are registered yet so the
 * empty dashboard doesn't look broken. Once the operator adds a node
 * the dashboard hides this and reveals the normal widgets.
 */
export function OnboardingPanel() {
  const t = useT();
  const [open, setOpen] = useState(false);

  const steps: { icon: 'plus' | 'key' | 'activity'; title: string; body: string }[] = [
    {
      icon: 'plus',
      title: t('onboarding.step1.title'),
      body: t('onboarding.step1.body'),
    },
    {
      icon: 'key',
      title: t('onboarding.step2.title'),
      body: t('onboarding.step2.body'),
    },
    {
      icon: 'activity',
      title: t('onboarding.step3.title'),
      body: t('onboarding.step3.body'),
    },
  ];

  return (
    <>
      <Card title={t('onboarding.title')} subtitle={t('onboarding.subtitle')}>
        <ol className={styles.onboardingSteps}>
          {steps.map((step, i) => (
            <li key={i} className={styles.onboardingStep}>
              <span className={styles.onboardingStepIcon}>
                <Icon name={step.icon} size={14} />
              </span>
              <div>
                <div className={styles.onboardingStepTitle}>{step.title}</div>
                <p className={styles.onboardingStepBody}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.onboardingActions}>
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={14} />
            {t('nodes.action.add')}
          </Button>
        </div>
      </Card>
      <NodeFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
