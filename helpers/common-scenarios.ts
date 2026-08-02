import { ScenarioConfig, ScenarioBuilder } from './scenario-runner';
import { PageManager } from '../pages/page-manager';

export class CommonScenarios {
  static createLoginScenario(
    pageManager: PageManager,
    email: string,
    password: string
  ): ScenarioConfig {
    return new ScenarioBuilder('User Login')
      .withDescription('Complete user login flow')
      .withTimeout(30000)
      .addStep('Navigate to login', async () => {
        await pageManager.getPage().goto('/login');
      })
      .addStep('Enter email', async () => {
        await pageManager.login().fillEmail(email);
      })
      .addStep('Enter password', async () => {
        await pageManager.login().fillPassword(password);
      })
      .addStep('Submit login', async () => {
        await pageManager.login().clickSubmit();
      })
      .addStep('Verify dashboard load', async () => {
        await pageManager.dashboard().waitForLoad();
      })
      .build();
  }

  static createMoneyTransferScenario(
    pageManager: PageManager,
    recipientId: string,
    amount: string,
    description: string
  ): ScenarioConfig {
    return new ScenarioBuilder('Money Transfer')
      .withDescription('Complete money transfer flow')
      .withTimeout(45000)
      .addStep('Navigate to money transfer', async () => {
        await pageManager.getPage().goto('/money-transfer');
      })
      .addStep('Wait for transfer form', async () => {
        await pageManager.moneyTransfer().waitForLoad();
      })
      .addStep('Fill recipient', async () => {
        await pageManager.moneyTransfer().fillRecipient(recipientId);
      })
      .addStep('Fill amount', async () => {
        await pageManager.moneyTransfer().fillAmount(amount);
      })
      .addStep('Fill description', async () => {
        await pageManager.moneyTransfer().fillDescription(description);
      })
      .addStep('Submit transfer', async () => {
        await pageManager.moneyTransfer().clickSubmit();
      })
      .addStep('Verify success message', async () => {
        await pageManager.moneyTransfer().waitForSuccess();
      })
      .build();
  }

  static createLoanApplicationScenario(
    pageManager: PageManager,
    amount: string,
    term: string
  ): ScenarioConfig {
    return new ScenarioBuilder('Loan Application')
      .withDescription('Complete loan application flow')
      .withTimeout(40000)
      .addStep('Navigate to loans', async () => {
        await pageManager.getPage().goto('/loans');
      })
      .addStep('Wait for loan form', async () => {
        await pageManager.loans().waitForLoad();
      })
      .addStep('Fill loan amount', async () => {
        await pageManager.loans().fillLoanAmount(amount);
      })
      .addStep('Fill loan term', async () => {
        await pageManager.loans().fillLoanTerm(term);
      })
      .addStep('Submit application', async () => {
        await pageManager.loans().clickApply();
      })
      .addStep('Verify application success', async () => {
        await pageManager.loans().waitForApplicationSuccess();
      })
      .build();
  }

  static createBillPaymentScenario(
    pageManager: PageManager,
    payee: string,
    amount: string,
    dueDate: string
  ): ScenarioConfig {
    return new ScenarioBuilder('Bill Payment')
      .withDescription('Complete bill payment flow')
      .withTimeout(40000)
      .addStep('Navigate to bill payments', async () => {
        await pageManager.getPage().goto('/bill-payments');
      })
      .addStep('Wait for bill payment page', async () => {
        await pageManager.billPayments().waitForLoad();
      })
      .addStep('Fill payee', async () => {
        await pageManager.billPayments().fillPayee(payee);
      })
      .addStep('Fill amount', async () => {
        await pageManager.billPayments().fillAmount(amount);
      })
      .addStep('Fill due date', async () => {
        await pageManager.billPayments().fillDueDate(dueDate);
      })
      .addStep('Submit payment', async () => {
        await pageManager.billPayments().clickPay();
      })
      .addStep('Verify payment success', async () => {
        await pageManager.billPayments().waitForPaymentSuccess();
      })
      .build();
  }

  static createVirtualCardScenario(
    pageManager: PageManager,
    cardName: string,
    limit: string
  ): ScenarioConfig {
    return new ScenarioBuilder('Virtual Card Creation')
      .withDescription('Create and configure virtual card')
      .withTimeout(35000)
      .addStep('Navigate to virtual cards', async () => {
        await pageManager.getPage().goto('/virtual-cards');
      })
      .addStep('Wait for virtual cards page', async () => {
        await pageManager.virtualCards().waitForLoad();
      })
      .addStep('Click create card', async () => {
        await pageManager.virtualCards().clickCreateCard();
      })
      .addStep('Fill card name', async () => {
        await pageManager.virtualCards().fillCardName(cardName);
      })
      .addStep('Fill spending limit', async () => {
        await pageManager.virtualCards().fillSpendingLimit(limit);
      })
      .addStep('Confirm creation', async () => {
        await pageManager.virtualCards().clickConfirm();
      })
      .addStep('Verify card created', async () => {
        await pageManager.virtualCards().waitForCardCreated();
      })
      .build();
  }

  static createProfileUpdateScenario(
    pageManager: PageManager,
    firstName: string,
    lastName: string
  ): ScenarioConfig {
    return new ScenarioBuilder('Profile Update')
      .withDescription('Update user profile information')
      .withTimeout(30000)
      .addStep('Navigate to profile', async () => {
        await pageManager.getPage().goto('/profile');
      })
      .addStep('Wait for profile page', async () => {
        await pageManager.profile().waitForLoad();
      })
      .addStep('Edit first name', async () => {
        await pageManager.profile().fillFirstName(firstName);
      })
      .addStep('Edit last name', async () => {
        await pageManager.profile().fillLastName(lastName);
      })
      .addStep('Save changes', async () => {
        await pageManager.profile().clickSave();
      })
      .addStep('Verify save success', async () => {
        await pageManager.profile().waitForSuccessMessage();
      })
      .build();
  }

  static createCompleteUserJourneyScenario(
    pageManager: PageManager,
    email: string,
    password: string,
    recipientId: string,
    transferAmount: string
  ): ScenarioConfig {
    return new ScenarioBuilder('Complete User Journey')
      .withDescription('Full user flow: login → transfer → view dashboard')
      .withTimeout(60000)
      .addStep('Navigate to login', async () => {
        await pageManager.getPage().goto('/login');
      })
      .addStep('Login user', async () => {
        await pageManager.login().fillEmail(email);
        await pageManager.login().fillPassword(password);
        await pageManager.login().clickSubmit();
      })
      .addStep('Wait for dashboard', async () => {
        await pageManager.dashboard().waitForLoad();
      })
      .addStep('View balance', async () => {
        await pageManager.dashboard().waitForBalance();
      })
      .addStep('Navigate to money transfer', async () => {
        await pageManager.getPage().goto('/money-transfer');
      })
      .addStep('Execute transfer', async () => {
        await pageManager.moneyTransfer().fillRecipient(recipientId);
        await pageManager.moneyTransfer().fillAmount(transferAmount);
        await pageManager.moneyTransfer().clickSubmit();
      })
      .addStep('Verify transfer success', async () => {
        await pageManager.moneyTransfer().waitForSuccess();
      })
      .addStep('Return to dashboard', async () => {
        await pageManager.getPage().goto('/dashboard');
      })
      .addStep('Verify updated balance', async () => {
        await pageManager.dashboard().waitForLoad();
      })
      .build();
  }
}
