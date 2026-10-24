INSANE STORE: COMPLETE SETUP GUIDE
==================================
Time needed: about 20 minutes. You need: a Google account (himanshu.yadav01241@gmail.com),
your Firebase project (himanshudevweb-2e30d, already filled in), and a free Netlify account.

PART 1. FIREBASE (the database and login)
-----------------------------------------
1. Go to console.firebase.google.com and open your project "himanshudevweb".
2. Realtime Database
   - Left menu: Build > Realtime Database. If you see "Create Database", click it, accept
     the location, choose "Locked mode", click Enable.
   - Click the "Rules" tab. Select everything in the box (Ctrl+A) and delete it.
   - Open database.rules.json from this folder in Notepad, copy ALL of it, paste it in
     the box, and click Publish.
   - This one file protects BOTH this store and your portfolio site. Always publish the
     whole file.
3. Google login
   - Left menu: Build > Authentication > "Get started" > Sign-in method > Google > Enable
     > choose a support email > Save.

PART 2. PUT THE STORE ONLINE (hosting)
--------------------------------------
Option A, easiest (Netlify):
   1. Unzip insane-store.zip so you have a folder called insane-store.
   2. Go to app.netlify.com/drop, sign up free, and drag the insane-store FOLDER onto the page.
   3. Netlify gives you an address like https://random-name.netlify.app. Open it: you should see
      the store. (Site settings > Change site name lets you pick a nicer name.)
Option B (GitHub Pages): create a repository, upload all files, then Settings > Pages >
   Deploy from branch > main.

PART 3. ALLOW YOUR WEBSITE TO USE GOOGLE LOGIN
----------------------------------------------
1. Firebase console > Build > Authentication > Settings tab > Authorized domains.
2. Click "Add domain" and type your Netlify address WITHOUT https://
   (for example random-name.netlify.app). Save.

PART 4. FIRST RUN
-----------------
1. Open https://your-address/admin.html and press "Sign in with Google" using
   himanshu.yadav01241@gmail.com.
2. The first sign-in adds 3 sample products, a WELCOME10 coupon (10% off above Rs 500) and
   your settings. A message appears at the bottom.
3. Dashboard tab shows your numbers. Products tab: edit the samples or delete them and add your own.

PART 5. TEST EVERYTHING (this is your practice run)
---------------------------------------------------
[ ] Products > Add product: name, price, old price, badge, stock count, 2 photos > Save.
[ ] Open the store in another tab: the product is there instantly. Open it: photos, share, save.
[ ] Write a review on it. In admin, Reviews tab > Approve. It now shows on the product.
[ ] Add to cart. Enter code WELCOME10 > Apply. Check the discount and delivery lines.
[ ] Place an order using your own phone number. Press "Send order on WhatsApp".
[ ] Admin > Orders: the order is there. Change status to Confirmed: stock goes down.
[ ] Back on the store press the box icon (top right): your order shows its progress.
[ ] Orders > Print invoice. Dashboard: the chart and best sellers update.
[ ] Settings: change the announcement text and delivery fee: the store updates instantly.
[ ] On your phone open the store in Chrome > menu > "Add to Home screen" to install it.

PART 6. SHOW IT TO CUSTOMERS
----------------------------
- Send them the store link and features.html (linked in the store footer). They can try
  the store but cannot open the admin panel; only your Google account can.
- Do a screen-share or short video of admin.html: adding a product, then watching it appear
  on the store, is the strongest demo.
- For a customer project, copy this folder, change the logo and name, and use a new Firebase
  project for them (so their data stays separate).

THE 3D LOOK AND ANIMATIONS (all in fx.js and shop.css)
-----------------------------------------------------
- Intro logo animation, then the headline rises word by word.
- 3D rotating carousel of your products at the top: drag or swipe to spin it, tap a card to open it.
  It uses your newest products and any with a badge, so it updates by itself.
- Product cards tilt in 3D with a light glare when you hover (computer only).
- Cards fade in as you scroll, loading shows shimmer placeholders, and the product photo flies
  into the cart when you press Add to cart. Product photos zoom on hover.
- Scrolling brand strip, scroll progress bar, back-to-top button, pulsing WhatsApp button.
- Animations switch off automatically for people who turned on "reduce motion" on their device.
To change colours, edit the :root and gradient colours at the top of shop.css.
To slow the carousel, change "9" in the line "const base = () => RM ? 0 : 9;" in fx.js.

TROUBLESHOOTING
---------------
"Permission denied": rules not published, or you are signed in with a different Google account.
Google sign-in popup does nothing: add your domain in Part 3, and do not open admin.html
   by double-clicking (it must be the https address).
Orders or reviews do not save: publish the rules (Part 1). The error code is shown on screen.
Photos will not upload: use JPG or PNG; each product holds up to 5.
Changes do not appear on the live site after you edit a file: re-upload the folder to Netlify.

WHAT EACH FILE TEACHES YOU (your learning map)
----------------------------------------------
index.html + shop.css      page structure, responsive design (mobile first)
shop.js                    state, rendering, cart maths, coupons, live database listeners
admin.html + admin.js      login, dashboard, forms, image resizing in the browser
database.rules.json        database security: who can read and write what
common.js                  shared helpers and Firebase start-up
manifest.json + sw.js      installable app (PWA) and offline support
Try these next: add a "Categories" admin page, product variants (sizes), or online payments
with Razorpay (needs a small server).
