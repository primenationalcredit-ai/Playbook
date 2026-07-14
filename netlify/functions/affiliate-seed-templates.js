// affiliate-seed-templates.js  (Playbook)
// Seeds affiliate_templates with the message library. Idempotent: wipes and reloads.
// Run manually after deploy (and after any library revision):
//   curl https://cute-cat-d9631c.netlify.app/.netlify/functions/affiliate-seed-templates
// Templates are DB rows after this - edit copy in the DB / page without redeploying.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(opts.headers || {}) }
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

// segment, step, channel, day_offset (days from cadence start), subject, body
const T = [];
const add = (segment, step, channel, day, subject, body) =>
  T.push({ segment, step_number: step, channel, day_offset: day, subject, body, active: true });

// ============ NEW_NEVER (signed up recently, no clients yet) ============
add('new_never', 1, 'email', 0, 'Two ways to send us your first client (both take under a minute)',
`Hey {first_name},

{consultant_name} here at ASAP. Your referral portal's live, so I wanted to make sure you've got everything you need to actually use it, because the partners who send someone in their first couple weeks are the ones who end up doing this for years.

There are two ways to get a client to us, and both work great:

The fastest one is a warm transfer. You've got someone in front of you or on the phone with a credit problem? Call my direct line at {consultant_phone}, three way me in or hand them off, and I'll take the whole conversation from there. We're here 8 to 5 Central, Monday through Friday. This one converts best because your client hears a real person immediately.

The other is your portal: {portal_link} Hit submit, drop in their name, phone, and email, and here's the part that matters most: use the notes box. Tell me what they're trying to get approved for, their timeline, anything personal I should know. Got their credit report? Upload it right there too. The more you give me, the better their first call goes. And your portal shows you every client's live status plus your payouts, any time.

A few things your clients will ask you, so you've got the answers ready: the consultation's completely free and they get an exact quote before paying a dime. It's one flat fee, around $600 on average, no monthly charges ever. Most people see first results inside 30 to 60 days, some in as little as two weeks. And if we get zero results, they get their money back. That last one matters, because it means you're never putting your name on a gamble.

And yes, you get paid on every client who signs up and pays.

Any questions about the portal, or about how our program works? Reply to this email and it comes straight to me, not a bot. Same day answer, promise.

{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 2, 'email', 4, 'The 15% partner vs the 70% partner (same leads, wildly different paychecks)',
`{first_name},

Fun stat from inside our shop: every month, two partners can send us the same number of referrals, same quality of people, and one converts 70 percent while the other barely scrapes 15. Same program. Same team. Wildly different paychecks.

The difference is never luck. After 13 years and 67,000 clients, we know exactly where it lives: the ten seconds where the client gets introduced to us.

Think about it from their side. Somebody just got told no. They're embarrassed, maybe a little defensive, and they've probably been burned by some company that took monthly fees and mailed form letters. So when they hear "you could try these guys, here's a website"... their guard goes UP. Another pitch. Another disappointment loading.

Here's what the 70 percent partners do instead. I call it the three part handoff, and the whole thing takes under two minutes.

PART ONE: THE WARM SENTENCE (10 seconds). And I'm giving you two versions, because the worst thing you can do is say something that isn't true for you yet. People can smell a borrowed recommendation.

Haven't sent us anyone yet? Your honest version: "I found a team that specializes in exactly this. They've helped over 67,000 people in 13 years, they only charge for actual results, and the consultation's free. Worst case, you get a free expert look at your report. Want the link?"

Every word verifiable. And it converts, because honesty converts.

Once you've sent someone and seen what we do, you unlock the stronger one: "I know this team personally. I've seen what they did for someone I sent them. Want me to connect you?"

PART TWO: THE CONTEXT (60 seconds). Warm transfer them to me at {consultant_phone} while the moment's hot, or submit them in your portal WITH notes: their goal, their deadline, their headspace. Scared? Burned before? Tell me. It changes my entire first call, because instead of a cold call from a stranger, it's a conversation with a friend of yours. Which is exactly what it is.

PART THREE: THE NUDGE (10 seconds, two days later). Text them: "Hey, did you connect with the ASAP team yet? You're gonna love them." That one text revives more stalled referrals than anything we've ever measured. Busy people need nudges. Nervous people need reassurance. That text is both.

Want proof? Two clients came in the same week. First one: name and number, no intro. We called, felt cold to them, never picked up again. Second one: warm handoff. Her referrer told us she was trying to buy a home, scared about her score, tired of being lied to. Our first words covered all of it. Hers were "I've been waiting to hear from you." Signed up same day. Three weeks later, her biggest negative account was gone and she was in underwriting.

Same team. Same program. Ten seconds of handoff was the entire difference.

{consultant_name}
ASAP Credit & Financial Services

P.S. Reply with the situation you run into most, a declined loan, a deal that died over a score, whatever it is, and I'll write you the exact talk track for that exact moment. Personally.`);

add('new_never', 3, 'call', 8, null,
`BEFORE DIALING: check the touch timeline, their email replies, and the Pipedrive follow-up notes on the card. LVM entries mean you have NOT actually spoken. Never open like a stranger if there is history.
- IF PRIOR CONTACT: reference it specifically and pick up that thread
- IF FIRST CONTACT: warm intro, "saw you're over at {company}, wanted to put a voice to the name"
- Their company and occupation are on the card, never ask what they do
- Ask how often they run into people with credit problems in their line of work
- Give the play for their world: lender = declined apps, realtor = pre-approval falls through, dealer = turned down at the desk, tax or insurance = clients who mention debt
- Remind them: warm transfer to your direct line converts best, portal with good notes is a close second
- Offer the talk track for their situation, and the "show me" case files if they haven't seen results yet
- Zero pressure close: "the first one's the hardest, after that it's muscle memory"`);

add('new_never', 4, 'sms', 12, null,
`Hey {first_name}, it's {consultant_name} with ASAP. Quick check-in since your portal went live. Any questions I can knock out? And if anyone in your world catches a no because of their credit, that's our lane. You can even warm transfer them straight to me: {consultant_phone} (Reply STOP to opt out)`);

add('new_never', 5, 'email', 18, 'Three collections. Fourteen days. All gone.',
`{first_name},

Story time, because this is the fastest way to show you what your name gets attached to when you send someone our way.

A client came to us with three collection accounts wrecking his file. Three different companies. He'd already tried disputing on his own through the online forms. Twice. Nothing moved. That's the normal experience out there, and it's why so many people think nothing can be done.

Here's what we did differently, and why it took fourteen days instead of forever.

Step one: we demanded proof, not attention. Most companies send the bureaus a letter that basically says "I dispute this," an automated check runs, the lender's computer says "yep, it's his," and the dispute dies. We skip that theater entirely. We went straight at all three companies and demanded the documentation the law requires them to keep: the original signed application, the complete payment ledger, the itemized breakdown, their communication records, proof their reporting was even legal.

Step two: the silence that says everything. Not one of the three companies responded. Not a letter, not a document. Why? Because they know us. We send over 100,000 dispute letters every single month, and the furnishers know exactly what we're going to ask for and that we don't go away. When a company can't produce the paperwork, they've got two options: fight a losing battle, or delete. All three deleted.

Step three: fourteen days later, clean file. Not "updated." Not "resolved." Gone, like they were never there.

That's the whole philosophy: we don't send hope, we send demands for proof, and whatever can't be proven comes off. Thirteen years, 67,000+ clients, 2.3 million records removed, 3,000+ five star reviews. That's the machine standing behind every referral you make.

Next time someone gets a no: warm transfer them to {consultant_phone}, or your portal's always open: {portal_link}

{consultant_name}
ASAP Credit & Financial Services

P.S. Want to see the actual letters from a case like this? Reply "show me" and I'll send the real dispute letter and the deletion that came back. Seeing it firsthand changes how confidently you refer.`);

add('new_never', 6, 'email', 30, 'How can we help you grow?',
`{first_name},

Honest check-in, no agenda, and I'll keep it short on purpose.

You've been set up with us about a month now, and I'd rather hear the truth than silence: what's getting in the way?

Some partners tell us they haven't run into the right person yet. Some say bringing up credit feels awkward. Some just forgot the portal exists because life's busy. All normal. All fixable.

Whatever yours is, reply and tell me, and I'll build you something for your exact situation. A word for word talk track for the moment you see most. A piece you can hand to clients. The case files that show what we actually do. Or if you've got someone in mind and the conversation feels weird, three way them to me at {consultant_phone} and I'll do all the talking. You literally just dial.

We're here to make you look good. That only works if I know where you're stuck.

{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 7, 'call', 42, null,
`BEFORE DIALING: read the timeline, replies, call 1 outcome, Pipedrive notes (LVM = never actually spoke). This continues a relationship, it does not restart one.
- Reference what you learned in call 1 or from replies, specifically
- Never sent anyone: "totally normal, most partners take a couple months for the first one. What would make it easier?"
- Offer the done-for-you assist: they three way you in or text-intro, you run the whole conversation
- Growth interest: top partners earn over $10,000 a month, offer to map the path for their business (skip money talk if no payout on file)
- Log what you learn, it drives everything after`);

// ============ REFERRED_PENDING (sent referrals, none sold yet) ============
add('referred_pending', 1, 'email', 0, 'Thank you for who you sent (and the tiny fix that converts them)',
`{first_name},

First things first: thank you for the {referred_deals} {referral_word} you've already sent our way. Most partners never send anyone. You're already doing the thing that matters, and I don't take it lightly.

None of them has signed up yet, and I want you to hear this clearly: that's normal, and it's almost always fixable. When a referral stalls, it's basically never about their need. Their credit problem didn't vanish. It's about how warm the introduction was, and what happened in the 48 hours after.

Here's what thousands of referrals have taught us: a person who gets a bare link signs up about 15 percent of the time. A person who gets one warm sentence first, plus a single follow-up text two days later, signs up 60 to 70 percent of the time. Same person. Same need.

So, two tiny moves:

Move one, for your next referral: before the link, one sentence. "This team's helped over 67,000 people in 13 years, they only charge for actual results, and the consultation's free." That kills the scam fear and the cost fear before they ever click. Or skip the link entirely and warm transfer them to me live at {consultant_phone}. That converts best of all.

Move two, for the {referred_deals} already in motion: text each of them today. "Hey, did you connect with the ASAP team yet? You're gonna love them." That text revives more stalled referrals than anything we've ever measured.

You're closer than you think. Want me to take another run at the ones you sent? Reply with anything you remember about what they needed, and I'll make sure our next call is one worth answering.

{consultant_name}
ASAP Credit & Financial Services

P.S. Want to see exactly what happens once someone does sign up? Reply "show me" and I'll send you a real case, actual letters and the deletion that came back.`);

add('referred_pending', 2, 'sms', 7, null,
`{first_name}, it's {consultant_name}. Quick one: a single text to your referrals ("did you talk to the ASAP team yet?") usually gets them moving again. Want the exact wording? Just reply. (Reply STOP to opt out)`);

add('referred_pending', 3, 'call', 14, null,
`BEFORE DIALING: check timeline, replies, Pipedrive notes for prior conversations (LVM = never spoke). They sent {referred_deals} referrals, zero converted. They are trying and probably a little discouraged. Lead with gratitude, never guilt.
- Prior contact exists? Continue that thread, do not restart
- Ask what happened when they shared the link: in person? Text? How did the person react?
- Diagnose the handoff: cold link drop, or warm intro?
- Teach the upgrade: warm transfer to your direct line beats everything
- Offer to have our team re-attempt the stalled referrals TODAY with fresh energy
- Give the one-liner for their industry (card has company and occupation)`);

add('referred_pending', 4, 'email', 24, 'Two referrers, one client each (this one is about YOUR people)',
`{first_name},

Quick story, because it's really the story of the {referred_deals} {referral_word} you've already sent.

Two clients got referred to us in the same week. The first came in as a name and a number. No intro, no context. To them, we were a cold call from a company they'd never heard of, about the most embarrassing topic in their life. They never picked up again.

The second came with a warm handoff. Her referrer told us she was trying to get a mortgage for her kids, scared about her score, and tired of being lied to. Our first call opened with all of that, gently. Her first words? "I've been waiting to hear from you." Signed up same day. Three weeks later her biggest negative account was deleted and she was in underwriting for the house.

Same team. Same program. The ten second introduction was the entire difference.

I suspect your people got the first experience instead of the second, and the fix costs you one text per person: "Hey, did you connect with the ASAP team yet? You're gonna love them." Send it today. Then reply here and tell me you did, and I'll make sure we call each of them within the day, armed with whatever context you can give me.

We can still win these. Together.

{consultant_name}
ASAP Credit & Financial Services`);

add('referred_pending', 5, 'email', 36, 'Where are you stuck?',
`{first_name},

No lesson this month. Just a question, and I'll keep it short.

What's the hardest part of this for you right now? Getting people to click the link? Knowing what to say? The people you sent going quiet on you?

Reply in one sentence and I'll send you something built for your exact situation: a talk track, the follow-up text script, or I'll simply have our team take another swing at the folks you already sent. Not a form response. Me, and I answer every reply.

You did the hard part already. You sent people. Let me help you get paid for it.

{consultant_name}
ASAP Credit & Financial Services`);

add('referred_pending', 6, 'call', 45, null,
`Conversion follow-through call. Check notes/timeline first (LVM = never spoke).
- Review which referrals are still open (card + Pipedrive)
- Report honestly what happened on our attempts, and what we try next
- Re-teach the system: one warm sentence, or better, warm transfer to your line
- Any referral converted since last touch? CELEBRATE it, congrats email is coming to them too`);

// ============ DORMANT (sold before, quiet 90+ days) ============
add('dormant', 1, 'email', 0, 'It has been a while, and that is on us',
`Hey {first_name},

I was going through our partner list and realized your last client with us was back in {last_referral_month}. You've sent us {sold_clients} {client_word} over time, and I don't want the silence since then to be because we dropped the ball somewhere.

So, honest question, no pitch attached: did something change on your end, or did we do something that made you stop sending people our way? If it's the second one, I genuinely want to know, because I'll personally run it down.

A few things have gotten better since {last_referral_month}, in case they matter to your clients. Progress Reports now go out on a set schedule, so the people you refer are never in the dark. First results are coming back faster, most clients see movement inside 45 days. And your portal shows you where every client you ever sent stands, plus your payouts, any time you feel like looking.

Either way, it's good to reconnect. Reply to this and it comes straight to me. I read every one.

{consultant_name}
ASAP Credit & Financial Services`);

add('dormant', 2, 'sms', 4, null,
`Hey {first_name}, {consultant_name} from ASAP. Sent you an email but texts are easier. You sent us {sold_clients} great {client_word} and then things went quiet on both sides. Anything we could be doing better? Straight answers welcome. (Reply STOP to opt out)`);

add('dormant', 3, 'call', 10, null,
`THE important win-back conversation. Check notes first (LVM = never spoke). Listen 80 percent.
- Open with appreciation, specific: "{sold_clients} clients came through you"
- The real question: "What would make it a no-brainer to send the next one?"
- Listen for: bad client experience, payout confusion, role change, a competitor
- Bad experience? Get the client name, promise to personally run it down, then DO it
- Payout? Confirm their method on file, fix anything stale
- Give before leaving: Handoff Guide, case files, or a co-branded piece
- Remind them warm transfers to your direct line exist now`);

add('dormant', 4, 'email', 20, 'The foreclosure nobody thought would come off',
`{first_name},

Want to share a full case with you, start to finish, because it says everything about what your referrals get over here. It's a foreclosure from a major national bank, and it took us three rounds and just under 120 days.

Round one: we asked for everything. Our client came in with a foreclosure blocking any future mortgage. Well documented. Already disputed once through another company. Already lost. Most programs won't touch a file like that. We opened by demanding every document the law requires: the signed application, promissory note, closing disclosures, deed of trust, every statement, the full payment ledger, default notices, and proof of compliance with state foreclosure law. And honestly? To our surprise, the bank produced ALL of it. Usually something's missing, and one missing document means automatic deletion. Not this time.

Round two: we read every page. Most companies quit right there. We got to work instead, line by line through that mountain, and found the cracks: inconsistent payment reporting across statements, ledger discrepancies, a misspelled legal name, and a date mismatch between the default notice and the reporting timeline. We packaged every error and filed. The bank refused to delete.

Round three: we escalated. Full case to all three bureaus, violations laid out with the court precedents behind them, removal demanded on provable inaccuracy. All three bureaus removed the foreclosure.

A hundred and twenty days from "impossible" to gone. That's what thirteen years and 2.3 million removed records look like in one file.

Your people were always in good hands here, and they still are. Next one that shows up: warm transfer to {consultant_phone}, or {portal_link}

{consultant_name}
ASAP Credit & Financial Services

P.S. If a client experience ever made you hesitate to send someone, reply and tell me about it. I'll pull the file personally and give you the straight story.`);

// ============ SLOWING (31 to 90 days since last sale) ============
add('slowing', 1, 'email', 0, 'Checking in on your people',
`{first_name},

Your last client came through in {last_referral_month} and I wanted to check in, partner to partner.

First: your portal shows where every client you've sent us stands, live, any time. And if you've got a question about one of them that a status page can't answer, reply and I'm happy to talk it through.

Second, a small thing that measurably helps your future referrals convert: the clients who sign up fastest are the ones told one sentence before they ever click. "They only charge for actual results, and the consultation's free." Ten seconds, and it flips people from skeptical to curious. Or skip the middle entirely and warm transfer them to me at {consultant_phone} while they're standing there.

Nothing needed from you. The door's open, and so am I. How's business on your end?

{consultant_name}
ASAP Credit & Financial Services`);

add('slowing', 2, 'sms', 10, null,
`{first_name}, it's {consultant_name}. If anyone in your world caught a no this month because of credit, that's our lane. Send them through your portal or warm transfer them to me at {consultant_phone} and I'll personally keep an eye on how they do. (Reply STOP to opt out)`);

add('slowing', 3, 'call', 21, null,
`Relationship maintenance plus one conversion idea. Check notes first (LVM = never spoke).
- Their business first, actually listen
- Any referrals that did NOT sign up? Offer to take another run at them
- Their numbers if useful: "{sold_clients} of your {referred_deals} referrals became clients, want to talk about the rest?"
- Offer the Handoff Guide if they never got it, and remind them the warm transfer line exists`);

// ============ PRODUCING (client in last 30 days) ============
add('producing', 1, 'email', 0, 'Your partner update',
`{first_name},

Quick partner update, then I'm out of your hair.

You've sent {referred_deals} {referral_word} our way, and {sold_clients} of them became paying {client_word}, including your most recent in {last_referral_month}. Thank you. Referrals are trust, and we don't take yours lightly.

Two things, always true. Your portal shows where every one of your clients stands, live, plus your payouts. And if anything's making referrals harder than it should be, a payout question, a client experience that bugged you, a tool you wish existed, tell me. I'll fix what I can and be straight with you about what I can't.

That's it. No ask. Keep sending people who need to get approval ready, and we'll keep making you look good for it.

{consultant_name}
ASAP Credit & Financial Services`);

// ============ PRODUCING_FIRST (very first client just sold) ============
add('producing_first', 1, 'email', 0, 'Congrats on your first client with us!',
`{first_name},

Congrats on your first client with us! Genuinely. Most people who sign up as a partner never send anyone, so you turning a referral into a signed client already puts you ahead of the pack.

Here's what happens now. We get your client moving, and most people see first results inside 45 days. They'll get Progress Reports on a set schedule so they're never in the dark, and you can watch their progress in your portal any time. And you get paid: once your client completes their program payments, your payout goes out on the 15th of the following month.

How are you feeling about everything so far? If anything was confusing, or if there's anything we could've done better on this first one, reply and tell me. I read every one of these.

And here's the fun part about first clients: the second one gets easier, because now when you say "I know this team, I've seen what they do," it's true. That sentence plus a warm transfer to {consultant_phone}, or your link, is the whole job: {portal_link}

Proud to have you as a partner.

{consultant_name}
ASAP Credit & Financial Services`);

// ============ COLD (signed up long ago, never sent) ============
add('cold', 1, 'email', 0, 'Just checking in',
`Hey {first_name},

Just checking in to see how you're doing. You set up a referral account with us a while back, and I wanted you to know it still works and we're still here.

No pitch. I'm genuinely curious what happened on your end. Never ran into the right person? Forgot we existed? Were never quite sure what we actually do?

The short version, in case it helps: when someone gets declined for a loan, a mortgage, a car, or an apartment because of their credit, our credit accelerator program gets them approval ready. We've done it for 67,000+ people across 13 years. The consultation's free, they only pay for actual results, and most see first movement inside 45 days.

Two ways to send someone whenever the moment shows up: your portal at {portal_link}, or warm transfer them straight to me at {consultant_phone}, Monday to Friday, 8 to 5 Central.

Anything that would make referring easier for you? Reply and tell me. I read every one.

{consultant_name}
ASAP Credit & Financial Services

P.S. If you were ever unsure whether this stuff actually works, reply "show me" and I'll send a real case from our files, the letters we sent and the deletions that came back. Seeing it changes everything.`);

add('cold', 2, 'email', 30, 'The moment to remember us',
`{first_name},

One idea, then I'm gone.

You don't need to go hunting for people with credit problems. You just need to remember one sentence for the moment someone mentions one. And that moment happens more than you'd think. It sounds like: "I got turned down." "My score tanked." "We have to wait until my credit's better." "The bank said come back in a year."

Every one of those sentences is someone quietly telling you they've got a problem worth thousands to solve, and no idea who solves it.

Your line: "I know a team that fixes exactly that. They've helped over 67,000 people, they only charge for results, and the consult's free. Want me to connect you?"

Then either send your link or, even better, three way them to me right there at {consultant_phone}. We take the entire conversation from that point. You never explain disputes. You never chase paperwork. One introduction, and you get paid when they sign up.

That's the whole business of being our partner. One remembered sentence: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('cold', 3, 'email', 60, 'What partners actually earn (real talk)',
`{first_name},

Real talk about the money, since we've never discussed it.

Some of our top partners earn over $10,000 a month from referrals alone. That's the ceiling, not the average, but it's real, it's paid monthly, and the math behind it isn't what most people picture.

Our most active partners aren't marketers. No ads, no content, no funnels. They're lenders, realtors, dealers, tax pros, and insurance agents who made exactly one change: instead of turning away the people they couldn't help, they route them to us.

Think about what a decline usually is: a dead end. The client leaves disappointed and the deal, the loan, the sale, dies with them. Our partners turned that same moment into a loop. The declined client comes to us, gets approval ready over 60 to 90 days, and comes BACK. The partner got paid on the referral, and then the original deal closes on the second try. Paid twice on a moment that used to be worth zero.

That's the recycle loop, and it's why the top of our board is full of ordinary professionals who simply stopped wasting their declines.

Your link still works whenever the next dead end walks in: {portal_link} Or warm transfer them to me live: {consultant_phone}

{consultant_name}
ASAP Credit & Financial Services

P.S. Reply with what you do for work and I'll send you the exact one-liner our top partners in your industry use. Two minutes for me, saves you the awkward part.`);

// ============ ROTATION (monthly value, every 3rd touch is a call) ============
add('rotation', 1, 'email', 30, 'How our process actually works (a real case, start to finish)',
`{first_name},

One of the questions we get most, from clients and partners alike: "how does your process actually work?" Fair question, because what we do looks nothing like what most people picture. So let me answer it with a real case.

A client came to us with a charge-off on an auto loan. Two years old, dragging his score, killing a business loan he needed. He'd already disputed it online. Twice. Nothing moved.

Here's why online disputes fail, and what we did instead.

When you dispute online, you're locked into preset checkbox reasons, the bureau runs an automated check, the lender's computer says "confirmed," and the dispute dies in days. Nobody ever actually looks at the account. Worse, the fine print on those forms can waive legal rights people don't know they have.

We took a different road entirely. Straight at the lender, demanding the documentation federal law requires them to keep: the original signed agreement, the complete payment ledger, the signed application, proof their reporting met compliance standards.

The lender replied... incompletely. Missing key documents. And an account that can't be verified must be deleted, that's the law. We filed on exactly those grounds, and the charge-off came off.

His score jumped. The business loan closed. The lender never sent so much as a complaint, because they know the law better than anyone. They just couldn't meet it.

That's our credit accelerator program in one story: we don't send hope, we send demands for proof, and what can't be proven comes off. 67,000 clients and 2.3 million removed records later, that's still the whole playbook.

Got someone this would help? Warm transfer them to me at {consultant_phone} or send them through {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 2, 'email', 30, 'The CEO Method (late payments, gone in three weeks)',
`{first_name},

Today I want to show you one of the fastest tools in our arsenal, because if you ever refer someone whose only problem is late payments, this is what happens to their file.

We call it the CEO Method, and the name is literal.

C is CHALLENGE. We open with a formal dispute demanding documentation that proves the late payment is valid. The payment records, the statements, the notice history. Not a complaint. A demand for proof.

E is ESCALATE. Here's where it gets fun. If the response comes back incomplete or wrong, and it usually does, we don't send another letter into the same customer service pile. We take the file straight to the top: executive leadership, often the office of the CEO, with the compliance problems laid out plainly. Executives read differently than call centers. They see liability.

O is OVERTURN. Faced with documented reporting problems on an executive's desk, companies almost always take the cheap exit: internal review, quick removal.

Real case: a client came in with one misreported late payment costing him his mortgage pre-approval. Not a collection, not a charge-off. One late payment. Three weeks with the CEO Method and it was deleted, his score jumped 50+ points, and the mortgage was approved.

Most people, honestly most companies in this industry, treat late payments like a life sentence. "Just wait seven years." We don't wait. We go to the top.

So next time someone tells you "it's just a couple late payments, probably not worth it," you'll know better. That person might be three weeks from approval: {portal_link}

{consultant_name}
ASAP Credit & Financial Services

P.S. Reply "guide" and I'll send you our CEO Method one-pager, good for your own reference or to hand a client.`);

add('rotation', 3, 'email', 30, 'The three mistakes that keep people stuck',
`{first_name},

We see it every single week: people come to us frustrated and stuck, not because of what's on their report, but because of the advice they followed first. Usually well-meaning. Usually from the internet, a bank teller, or an uncle.

Here are the big three, why each backfires, and the moment to listen for. Catch these in conversation and you'll spot referral moments everyone else misses.

MISTAKE ONE: paying off negative debt. Sounds responsible, right? But paying a collection doesn't remove it. The damage stays for years, and here's the cruel twist: paying can actually LOWER the score short-term, because it updates the "last activity" date and makes old damage look fresh. We check the legal standing of the debt first. If the collector can't validate it with documentation, it doesn't get paid. It gets deleted.

The moment: "I'm gonna pay off these collections and then apply." Stop them. That order of operations can cost them the approval, and remember Diana? She almost paid $4,200 on a collection before her loan officer sent her to us. We disputed instead, the creditor couldn't produce the contract, it came off in 24 days, and she kept her $4,200 AND got her SBA loan.

MISTAKE TWO: debt consolidation. One payment, one rate, sounds clean. Reality: it closes accounts, crushes the average account age, drops the score, and most people pay more over time. And the negatives it "consolidates"? Often still sitting right there on the report. We remove what can't be legally verified instead of repackaging it.

The moment: "I'm thinking about one of those consolidation programs." That person needs a free second opinion before they sign anything.

MISTAKE THREE: disputing online. The bureaus made it convenient on purpose. Preset checkboxes, automated verifications that never dig in, fine print that can waive rights. Then the person concludes "I tried, nothing works" and gives up forever. Our disputes are custom-built, documentation-driven, and sent where they create legal obligation.

The moment: "I already tried disputing, it didn't work." That's not the end of their story. It's usually the beginning of ours.

One sentence saves people from all three: "Before you do that, let me connect you with a team I trust. The consult's free." Then {portal_link}, or three way them to me at {consultant_phone}.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 4, 'email', 30, 'Two referrers, one client each (the ten seconds that decide everything)',
`{first_name},

Short story this month, because it carries the single most valuable lesson in this whole partnership.

Two clients got referred to us in the same week. On paper, identical: both needed to get approval ready, both sent by partners we like, both got the same team and the same process.

The first came in as a name and a phone number. No intro, no context. When we called, we were a stranger from an unknown company calling about the most embarrassing subject in their life. Second call, no answer. Third, same. That referral died, and the partner never got paid.

The second came with a warm handoff. Her referrer told us she was trying to buy a home for her kids, scared about her score, and had been lied to by another company before. We opened with all of that, gently. Her first words: "I've been waiting to hear from you." Signed up same day. Three weeks later, her biggest negative account was deleted and she was in underwriting.

Same team. Same program. Ten seconds of introduction was the entire difference between a dead lead and a changed life.

The whole lesson in three moves: one warm sentence before the link. Context in the portal notes (goal, deadline, headspace) or better yet a live warm transfer to {consultant_phone}. And the two-day text: "Did you connect with the ASAP team yet? You're gonna love them."

That's the entire edge our top partners have over everyone else.

{consultant_name}
ASAP Credit & Financial Services

P.S. Next referral, run all three moves and then reply and tell me what happened. I keep score on these, and the pattern never misses.`);

add('rotation', 5, 'email', 30, 'Where are you stuck?',
`{first_name},

No lesson this month. Just a question, and I'll keep it short on purpose.

What's the hardest part of referring for you right now?

For some partners it's spotting the moment. For some it's bringing up credit without it feeling awkward. For some, their industry just doesn't surface these conversations much. And for some, honestly, it's that we haven't given them the right tools yet.

Whatever yours is, reply and tell me in one sentence. I'll send back something built for your exact situation: a talk track, a script for your team, a piece to hand clients, or the case files that show exactly what we do. Not a form response. Me, and I answer every reply.

We're here to make you look good. Help me do my job.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 6, 'email', 30, 'Why I started this company (a note from our founder)',
`{first_name},

Something a little different this month: the story behind the company you partner with, in our founder's own words. Worth two minutes.

"I started ASAP in 2013 because I watched good people get treated like case numbers. They'd come in with reports full of accounts that were flat-out wrong, collections that weren't theirs, balances reported incorrectly, on-time payments marked late, and the entire industry's answer was the same: mail a form letter and hope.

I couldn't accept that the burden of proof sat on the consumer. The law says the opposite. The law says the companies reporting this information have to be able to PROVE it, with documentation, and if they can't, it comes off. So we built our whole company on that one idea: stop hoping, start demanding proof.

Thirteen years later, that idea has served over 67,000 clients. We've removed more than 2.3 million inaccurate records. We send over 100,000 dispute letters a month, and the companies on the other side know our name. We bill for results, not promises, because I never wanted to be one more company collecting a monthly fee while a family waits.

But here's the part that matters to you. The clients who change the most are almost never the ones who found us through an ad. They're the ones somebody SENT. Somebody they trusted said 'I know a team that can fix this,' and that trust is half the battle before we ever pick up the phone. That's why we take our partners so seriously. You're not a marketing channel to us. You're the reason a scared person answers the phone.

So thank you for being one of the people who sends them."

Joe Mahlow, Founder and CEO

If any of that raises a question, or you've got a story about someone you sent us, reply. We both read them.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 7, 'email', 30, 'What the top of the partner board looks like',
`{first_name},

Once in a while I like to pull back the curtain on our highest-earning partners, because what they do differently is way less impressive than you'd hope. Which is great news for you.

The number first, so you know what's possible: our top partners earn over $10,000 a month from referrals. Not from ads. Not from content. From conversations they were already having.

Here's everything they do differently. All three things.

One: they mention us IN the decline conversation, not weeks later. The moment someone hears "no," they hear "and here's what you can do about it" in the same breath. Motivation to fix credit peaks in the exact moment it costs something. Wait a week and embarrassment wins.

Two: the link travels WITH the recommendation. Not "I'll connect you later." Later never comes. Sentence and link, same text, while the pain is fresh. Or the power move: "actually, hold on, let me get them on the phone right now" and a warm transfer to {consultant_phone}. Nothing converts harder than that.

Three: the two-day text. "Did you connect with the ASAP team yet? You're gonna love them." Ten seconds. Revives the busy, reassures the nervous, single highest-converting behavior we've ever measured.

That's the entire playbook. No funnels, no scripts longer than a sentence, no marketing budget. The top of our board is ordinary professionals who simply send the most people and hand them off warm.

And the math takes care of itself: every decline you used to lose becomes a referral payout plus a future closed deal when they come back approval ready. The five-figure partners didn't find more leads. They stopped wasting their declines.

{consultant_name}
ASAP Credit & Financial Services

P.S. Want to know what YOUR path to the top of the board looks like? Reply "map it" and I'll call you this week and build it with you. Real offer.`);

add('rotation_call', 1, 'call', 30, null,
`Monthly relationship call (every 3rd monthly touch is human, forever). No agenda, no pitch. Check notes FIRST (LVM = never actually spoke).
- Review the card: their numbers, industry, Pipedrive notes, replies
- Open warm and specific: reference something real (last client, their industry's season, a reply they sent)
- Ask how business is going, actually listen for referral moments in the answer
- One idea for their world: lenders = declined apps, realtors = failed pre-approvals, dealers = desk turndowns, tax = refund-season debt talk, insurance = rated-up clients
- Remind them the warm transfer line exists: your direct number, 8 to 5 Central weekdays
- Unconverted referrals? Offer a fresh team run at them this week
- Close: "anything you need from us? Talk track, case files, anything, I'll send it today"
- Log the outcome, it feeds every message after`);

exports.handler = async () => {
  try {
    const del = await supa('affiliate_templates?id=gt.0', { method: 'DELETE' });
    if (!del.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'wipe failed: ' + del.text.slice(0, 200) }) };
    let inserted = 0;
    for (let c = 0; c < T.length; c += 50) {
      const chunk = T.slice(c, c + 50);
      const ins = await supa('affiliate_templates', { method: 'POST', body: JSON.stringify(chunk) });
      if (!ins.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'insert failed: ' + ins.text.slice(0, 200), inserted }) };
      inserted += chunk.length;
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, templates: inserted }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e).slice(0, 300) }) };
  }
};
