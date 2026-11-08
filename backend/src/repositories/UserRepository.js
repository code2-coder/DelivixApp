import { BaseRepository } from "./BaseRepository.js";
import User from "../models/User.js";

export class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email, options = {}) {
    return this.findOne({ email: email.toLowerCase().trim() }, options);
  }

  async findByVerificationToken(token, options = {}) {
    return this.findOne({ emailVerificationOTP: token }, options);
  }

  async findByResetToken(token, options = {}) {
    return this.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    }, options);
  }

  async findByGoogleId(googleId, options = {}) {
    return this.findOne({ googleId }, options);
  }
}

export default new UserRepository();
