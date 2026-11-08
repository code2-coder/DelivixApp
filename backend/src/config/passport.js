import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

const callbackURL = process.env.GOOGLE_CALLBACK_URL || "https://shreeharikripa.onrender.com/api/v1/auth/google/callback";

// Only register Google OAuth strategy if credentials are present.
// Skipping gracefully prevents a startup crash when env vars are missing.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          // Check if user already exists by email
          let user = await User.findOne({ email });

          if (user) {
            // If user exists, ensure googleId is set and sync their avatar
            let updated = false;
            if (!user.googleId) {
              user.googleId = profile.id;
              updated = true;
            }
            const googleAvatarUrl = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : "";
            if (googleAvatarUrl && (!user.avatar || !user.avatar.url || user.avatar.public_id === "google_avatar" || user.avatar.url !== googleAvatarUrl)) {
              user.avatar = {
                public_id: "google_avatar",
                url: googleAvatarUrl,
              };
              updated = true;
            }
            if (updated) {
              await user.save({ validateBeforeSave: false });
            }
            return done(null, user);
          }

          // Create new user if doesn't exist
          user = await User.create({
            name: profile.displayName || "Google User",
            email: email,
            googleId: profile.id,
            provider: "google",
            isVerified: true, // Google emails are verified by default
            avatar: {
              public_id: "google_avatar",
              url: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : "",
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );
  console.log("[Passport] Google OAuth strategy registered.");
} else {
  console.warn("[Passport] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. Google OAuth is disabled.");
}

export default passport;
