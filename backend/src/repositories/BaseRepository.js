export class BaseRepository {
  constructor(model) {
    if (!model) {
      throw new Error("Mongoose model must be provided to BaseRepository");
    }
    this.model = model;
  }

  async find(filter = {}, options = {}) {
    let query = this.model.find(filter);
    
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.sort) {
      query = query.sort(options.sort);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.skip) {
      query = query.skip(options.skip);
    }
    if (options.lean) {
      query = query.lean();
    }
    
    return query.exec();
  }

  async findOne(filter = {}, options = {}) {
    let query = this.model.findOne(filter);
    
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.lean) {
      query = query.lean();
    }
    
    return query.exec();
  }

  async findById(id, options = {}) {
    let query = this.model.findById(id);
    
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.lean) {
      query = query.lean();
    }
    
    return query.exec();
  }

  async create(data) {
    return this.model.create(data);
  }

  async updateById(id, data, options = { new: true }) {
    return this.model.findByIdAndUpdate(id, data, options).exec();
  }

  async updateOne(filter, data, options = { new: true }) {
    return this.model.findOneAndUpdate(filter, data, options).exec();
  }

  async deleteById(id) {
    return this.model.findByIdAndDelete(id).exec();
  }

  async deleteMany(filter = {}) {
    return this.model.deleteMany(filter).exec();
  }

  async count(filter = {}) {
    return this.model.countDocuments(filter).exec();
  }
}
