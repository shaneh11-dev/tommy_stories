# Facebook posts

Posts for the Tommy Stories Facebook Page are written here, approved by
merging them into the website's main branch, and published automatically at
their scheduled times.

Nothing in `social/` is shown on the website (see `_redirects`).

## How it works

1. **Drafting.** Each week a batch of posts is drafted (by Claude, or by hand)
   on a new branch and opened as a pull request: the text files in
   `social/posts/`, their pictures in `social/posts/images/`, and the picture
   descriptions in `social/cards/`.
2. **Approving.** Read the pull request on GitHub. The "Files changed" tab
   shows each post's text, and each picture can be opened. Edit anything
   right there, delete a post you don't want, then **merge**. Merging is the
   approval: only merged posts can go out.
3. **Posting.** Every 15 minutes, the website's `facebook-poster` function
   publishes any merged post whose time has come, through Facebook's Pages
   API. Each post goes out once.
4. **Problems** come to support@ by email: a post Facebook didn't accept, a
   post more than 6 hours late (it's skipped rather than posted at an odd
   hour; give it a new time if you still want it), or a file the robot can't
   read.

To stop a post that's already merged: open its file on GitHub, add a line
`skip: yes` above the `---`, and commit. Or delete the file.

To see what happened: Netlify > **Logs > Functions > facebook-poster**.

## The post format

One file per post, named by its date, time and a few words
(`2026-11-26-0900-name-that-car-corvair.md`). Settings at the top, a line
with just `---`, then the post text exactly as it should appear:

```
time: 2026-11-26 09:00
image: 2026-11-26-0900-name-that-car-corvair.png
---
🚗 Name That Car Thursday!

Can you name this car? ...
```

- `time:` Eastern time (it follows daylight saving), 24-hour clock:
  `2026-11-26 19:30` is 7:30 p.m.
- `image:` one picture from `social/posts/images/`, posted with the text.
- `images:` several pictures, separated by commas (up to 10), posted together.
- `link:` instead of a picture, a link Facebook shows as a preview card
  (`link: https://tommystories.com/gift/`). Links typed in the text are
  clickable either way.
- No picture and no link: a text-only post.
- `skip: yes` holds the post back.

## The pictures

Pictures are 1080 x 1350 cards in the booklet's navy and gold, made from a
small description in `social/cards/`:

```
python3 social/tools/cards.py social/cards/2026-11-26-0900-name-that-car-corvair.json
```

Kinds: `name-that-car`, `answer`, `question`, `remember` and `quote`. The top
of `social/tools/cards.py` shows what each one needs. Photos work too: put a
JPG or PNG in `social/posts/images/` and name it in `image:` (only use photos
you took, or that readers sent with permission).

## Connecting Facebook (one time)

The robot needs two settings in Netlify: the Page's ID and a Page key
("access token") that lets it post. Until both are set, it only logs what it
would post.

1. Go to **developers.facebook.com**, log in with the Facebook account that
   manages the Tommy Stories Page, and accept the developer terms if asked.
2. **My Apps > Create app.** Name it "Tommy Stories Poster". When asked
   what it's for, choose the option to manage a Page (wording varies; pick
   the one about managing everything on your Page, or "Other", then
   "Business"). Leave the app in **Development** mode; it never needs to be
   published, because only you use it.
3. Open the **Graph API Explorer** (Tools menu). At the right:
   - **Meta App:** Tommy Stories Poster
   - **User or Page:** User token
   - **Permissions:** add `pages_show_list`, `pages_read_engagement`
     and `pages_manage_posts`
   - Press **Generate Access Token** and approve, choosing the Tommy Stories
     Page.
   - If `pages_manage_posts` isn't in the list, open the app's dashboard,
     go to **Use cases**, customize the Page use case, add that permission,
     and come back.
4. Make that key long-lasting: click the small **i** next to the key, then
   **Open in Access Token Tool**, then **Extend Access Token** at the bottom.
   Copy the new, longer key.
5. Back in the Graph API Explorer, paste the long key into the token box,
   enter `me/accounts` in the address box, and press **Submit**. In the
   answer, find the Tommy Stories Page: copy its `id` and its
   `access_token`. This Page key doesn't expire.
6. Check it: paste the Page key into the **Access Token Debugger**
   (developers.facebook.com/tools/debug/accesstoken). It should say
   **Type: Page** and **Expires: Never**.
7. In Netlify: **Project configuration > Environment variables > Add a
   variable**: `FB_PAGE_ID` = the id, `FB_PAGE_TOKEN` = the Page key
   (mark it secret). Then **Deploys > Trigger deploy > Deploy project**.

The key is like a password to post on the Page: keep it only in Netlify.

### Reconnecting Facebook

The Page key stops working if you change your Facebook password, remove the
app, or lose your role on the Page. You'll get an email saying Facebook
didn't accept a post. Repeat steps 3 to 7 and replace `FB_PAGE_TOKEN`.

## Settings

- `FB_PAGE_ID`, `FB_PAGE_TOKEN`: required to post.
- `FB_GRAPH_VERSION`: optional, the Facebook API version (default `v25.0`).
  Facebook retires old versions after about two years; if posts start
  failing with a version error, set this to the newest version.
- `SMTP_USER`, `SMTP_PASS`: already set for the website's emails; problems
  are emailed to `SMTP_USER`.
