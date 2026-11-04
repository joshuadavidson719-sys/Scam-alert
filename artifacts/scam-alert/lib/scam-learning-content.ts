export type KnowledgeCheck = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

// Fictional victim-perspective examples. They teach recognition and a safe
// response, not how to carry out a scam. No generation service is called.
const situations: Record<string, [string, string, string]> = {
  "bank-impersonation": [
    "Your phone shows your bank's name. The caller says your savings are in danger and asks you to read out a security code.",
    "Read out the code because the bank's name appears on screen.",
    "Transfer your savings to the account the caller recommends.",
  ],
  "fake-payment-receipt": [
    "You are selling a phone. The buyer shows a transfer screenshot and wants to leave, but your own account shows no incoming payment.",
    "Hand over the phone because the screenshot looks official.",
    "Pay a release fee to receive the buyer's transfer.",
  ],
  "romance-emergency": [
    "Someone you met online becomes affectionate quickly. They repeatedly cancel meetings, then ask you to pay an urgent hospital bill.",
    "Send the money to prove that you trust them.",
    "Borrow money and keep the request secret from your friends.",
  ],
  "fake-job-fee": [
    "A recruiter offers you a remote job without an interview. Before you start, they want an equipment payment to a personal account.",
    "Pay before someone else takes the position.",
    "Send your bank login so the recruiter can arrange payment.",
  ],
  "delivery-text": [
    "A text says your parcel cannot be delivered until you pay a small fee. You were not expecting a package.",
    "Enter your card details because the requested fee is small.",
    "Reply with your full address and a photo of your ID.",
  ],
  "whatsapp-takeover": [
    "A friend's account messages you: 'I sent a code to your number by mistake. Please forward it.' A registration code arrives.",
    "Forward the code because the message came from a friend.",
    "Post the code in your group chat for help.",
  ],
  "fake-investment": [
    "An advertisement promises to double your money in a week with no risk. The promoter says the opportunity closes tonight.",
    "Invest quickly before checking the company.",
    "Trust the promise because there are many positive comments.",
  ],
  "marketplace-deposit": [
    "A seller lists a cheap refrigerator. They refuse an inspection and demand an immediate deposit to stop other buyers taking it.",
    "Send a private transfer to secure the bargain.",
    "Pay a larger deposit to show you are serious.",
  ],
  "fake-police-call": [
    "A caller claims there is a warrant for your arrest. They say buying gift cards today will make the case disappear.",
    "Buy the gift cards and share the codes.",
    "Keep the call secret because the caller ordered you to.",
  ],
  "family-new-number": [
    "A message says, 'Hi Mum, my phone broke. This is my new number.' It then requests money for an urgent bill.",
    "Send the money because the sender calls you Mum.",
    "Use only the new number to confirm who is speaking.",
  ],
  "qr-code-parking": [
    "At a car park, a payment QR sticker looks pasted over another code. Its website asks for your card details.",
    "Pay through the sticker without checking the destination.",
    "Enter your card PIN to prove ownership of the card.",
  ],
  "fake-support-popup": [
    "A browser page sounds an alarm and claims your computer is infected. A large number says to call support immediately.",
    "Call the number and pay for an emergency repair.",
    "Install the remote-control app recommended by the page.",
  ],
  "remote-access-bank": [
    "An unexpected caller claiming to be from your bank asks you to share your screen and approve remote control of your phone.",
    "Approve remote access so the caller can fix the problem.",
    "Open your banking app while the stranger watches your screen.",
  ],
  "rental-deposit": [
    "An online apartment looks affordable. The supposed landlord is abroad and insists on a deposit before any viewing can happen.",
    "Pay because the listing has attractive photos.",
    "Send your ID and deposit before checking the property.",
  ],
  "fake-charity": [
    "After a disaster, an unfamiliar account shares emotional photos and asks for urgent donations to a personal payment account.",
    "Donate immediately because the photographs are upsetting.",
    "Share the payment request widely without checking it.",
  ],
  "crypto-recovery": [
    "After you report a crypto loss online, someone guarantees recovery if you pay first and provide your wallet's recovery phrase.",
    "Share your recovery phrase with the supposed specialist.",
    "Pay the guaranteed recovery fee without independent verification.",
  ],
  "task-job": [
    "A task app pays you a small amount for ratings. It later says you must deposit your own money to unlock larger earnings.",
    "Keep depositing money so you can withdraw the balance.",
    "Borrow money to finish the next task.",
  ],
  "fake-loan": [
    "A lender guarantees a loan despite your circumstances. They demand an insurance payment to a personal account before releasing any funds.",
    "Pay the fee because approval is guaranteed.",
    "Send additional fees whenever the lender asks.",
  ],
  "lottery-prize": [
    "You receive a message saying you won a competition you never entered. A processing payment is required to collect the prize.",
    "Pay the fee so you do not lose the prize.",
    "Send a photo of your bank card to prove your identity.",
  ],
  "account-suspension-email": [
    "An email says your account closes in one hour. Its login button leads to a misspelled version of the service's address.",
    "Use the email's button to sign in immediately.",
    "Reply with your password to prevent suspension.",
  ],
  "deepfake-relative": [
    "A distressed caller sounds like your relative. They demand money, tell you not to call anyone else, and refuse a callback.",
    "Send money because the voice sounds familiar.",
    "Keep the emergency secret and follow every instruction.",
  ],
  "fake-business-invoice": [
    "An email appearing to come from your regular supplier says their bank account changed. A large invoice is due today.",
    "Use the new account without checking through a known contact.",
    "Confirm the change only by replying to the same email.",
  ],
  "overpayment-refund": [
    "A buyer claims to have overpaid you and requests a quick refund. You cannot confirm that their original payment is valid.",
    "Refund the difference before speaking to your payment provider.",
    "Use your savings to return the claimed overpayment.",
  ],
  "subscription-renewal": [
    "A surprise email receipt says you paid for software. Its refund number leads to someone asking to control your computer.",
    "Install the refund agent's remote-access software.",
    "Pay a cancellation fee to the person who answered.",
  ],
  "visa-work-permit": [
    "A social-media agent guarantees a work visa. They say an immediate personal transfer will bypass the normal application process.",
    "Pay because approval is guaranteed.",
    "Send all your documents before checking the agent's authorization.",
  ],
  "scholarship-fee": [
    "You receive a scholarship offer although you never applied. You must pay a registration fee today to keep the award.",
    "Pay immediately so the scholarship is not offered elsewhere.",
    "Send sensitive documents to the unverified sender.",
  ],
  "fake-online-store": [
    "An unfamiliar shop advertises new phones at a fraction of the usual price. It accepts only irreversible private transfers.",
    "Pay because the shop's own reviews are excellent.",
    "Buy several phones before the discount ends.",
  ],
  "social-media-clone": [
    "A second profile using your friend's name and photos sends a request. It soon asks for money and an account code.",
    "Accept the request and send the code immediately.",
    "Trust the profile because the photographs match.",
  ],
  "sim-swap-warning": [
    "Your phone suddenly loses service and an unexpected password-reset alert arrives. Other people nearby still have a connection.",
    "Ignore both events until the next day.",
    "Send security codes to someone offering help in a private message.",
  ],
  "public-wifi": [
    "A network named like the cafe asks for your payment-card details. Staff have not confirmed that it belongs to the cafe.",
    "Enter card details because the network name looks familiar.",
    "Use the unverified network to reset your bank password.",
  ],
  "fake-apartment-agent": [
    "An agent offers a property they cannot show and will not let you contact the owner. They want a reservation transfer.",
    "Pay because the agent knows the property's address.",
    "Treat copied property photos as proof of authority.",
  ],
  "ticket-resale": [
    "A stranger offers sold-out concert tickets through private messages. They show a barcode screenshot but cannot use the official transfer system.",
    "Pay privately because the barcode looks real.",
    "Share the screenshot with friends as proof the ticket is valid.",
  ],
  "fake-customer-care": [
    "After you complain publicly about a bank, an unverified support account contacts you privately and asks for your login code.",
    "Share the code so the account can investigate.",
    "Assume the account is genuine because it replied quickly.",
  ],
  "gift-card-payment": [
    "A message appearing to be from your manager asks you to buy gift cards urgently and send photos of their codes.",
    "Buy the cards without checking through your usual contact.",
    "Send the codes because the request is marked confidential.",
  ],
  "fake-tax-refund": [
    "A text says a government tax refund is waiting. It links to a form requesting your card details and online-banking password.",
    "Enter the requested details to receive the refund.",
    "Forward the refund link to other people.",
  ],
  "pig-butchering": [
    "A new online friend spends weeks building trust, then guides you to an investment site they say only special contacts can access.",
    "Invest because the relationship feels genuine.",
    "Deposit more when the site demands a fee to withdraw.",
  ],
  "money-mule": [
    "A job pays you to receive strangers' transfers into your personal bank account, send them elsewhere, and keep a percentage.",
    "Accept because you only move the money, not keep all of it.",
    "Let the employer use your banking login.",
  ],
  "fake-app-download": [
    "A supposed adviser sends an app file and tells you to disable your phone's security warnings before installing it.",
    "Disable the warnings because the adviser says it is safe.",
    "Approve every permission to complete setup quickly.",
  ],
  "sextortion": [
    "Someone threatens to share intimate material unless you send money. They demand secrecy and say the price will rise if you wait.",
    "Send more intimate material to persuade the person to stop.",
    "Handle the threats alone and keep paying every demand.",
  ],
  "fake-pet-sale": [
    "A seller requests payment for a puppy you cannot see live. After you pay a deposit, unexpected transport and insurance fees appear.",
    "Keep paying each new fee to avoid losing the deposit.",
    "Trust the sale because the puppy photos are attractive.",
  ],
  "travel-booking": [
    "A travel page advertises a cheap holiday. It wants a private transfer, and the hotel cannot confirm any reservation under your name.",
    "Pay quickly because the package is discounted.",
    "Treat a booking screenshot as final confirmation.",
  ],
  "fake-account-verification": [
    "A private message offers a verification badge. It sends you to a login page outside the platform and asks for a recovery code.",
    "Enter the recovery code to receive the badge.",
    "Pay the sender privately to make approval faster.",
  ],
  "school-fee-change": [
    "A message claiming to be from your child's school lists new fee-payment details. The school has not confirmed the change elsewhere.",
    "Transfer the fees without checking with the school.",
    "Verify only by messaging the same unconfirmed sender.",
  ],
  "fake-utility-threat": [
    "A caller threatens to disconnect your electricity within minutes unless you make a payment through an unfamiliar channel.",
    "Pay immediately without checking your utility account.",
    "Give the caller your card PIN to speed up payment.",
  ],
  "fake-health-product": [
    "An advertisement promises a guaranteed cure and claims doctors are hiding it. The seller urges you to stop prescribed treatment.",
    "Stop treatment and buy the product immediately.",
    "Trust a celebrity endorsement without checking its source.",
  ],
  "fake-celebrity-giveaway": [
    "A celebrity-looking livestream says anyone who sends cryptocurrency now will receive twice as much back. Viewers are told to hurry.",
    "Send money because the video looks convincing.",
    "Send a larger amount to receive a larger reward.",
  ],
  "cloud-storage-warning": [
    "An email says all your stored photos will be deleted tonight unless you update payment details through its unfamiliar link.",
    "Use the email's payment link without checking your account.",
    "Reply with your card number to save your photos.",
  ],
  "fake-freelance-client": [
    "A new client sends more than agreed and tells you to pay their equipment supplier before the payment has been verified.",
    "Forward money immediately to keep the client happy.",
    "Use your own funds while waiting for payment verification.",
  ],
  "disaster-relief-grant": [
    "A stranger promises a government relief grant after a storm. They require a processing transfer and personal documents through messaging.",
    "Pay because the message uses an official-looking logo.",
    "Send documents before finding the official relief program.",
  ],
  "after-a-scam": [
    "You sent money and now suspect a scam. The person asks for one more fee, while another stranger promises guaranteed recovery.",
    "Send another payment to unlock a refund.",
    "Delete the conversation because it feels embarrassing.",
  ],
};

export function learningContent(id: string, safeAction: string, warning: string, index: number): {
  example: string;
  knowledgeCheck: KnowledgeCheck;
} {
  const situation = situations[id];
  if (!situation) throw new Error(`Missing educational scenario: ${id}`);
  const [example, wrongOne, wrongTwo] = situation;
  const options = [wrongOne, wrongTwo];
  const correctIndex = index % 3;
  options.splice(correctIndex, 0, safeAction);
  return {
    example,
    knowledgeCheck: {
      question: "In this situation, what is the safest next step?",
      options,
      correctIndex,
      explanation: `${safeAction} The warning sign to notice is: ${warning.charAt(0).toLowerCase()}${warning.slice(1)}`,
    },
  };
}
