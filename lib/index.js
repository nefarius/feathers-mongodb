'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = init;

var _lodash = require('lodash.omit');

var _lodash2 = _interopRequireDefault(_lodash);

var _mongodb = require('mongodb');

var _uberproto = require('uberproto');

var _uberproto2 = _interopRequireDefault(_uberproto);

var _feathersQueryFilters = require('feathers-query-filters');

var _feathersQueryFilters2 = _interopRequireDefault(_feathersQueryFilters);

var _feathersErrors = require('feathers-errors');

var _feathersErrors2 = _interopRequireDefault(_feathersErrors);

var _feathersCommons = require('feathers-commons');

var _errorHandler = require('./error-handler');

var _errorHandler2 = _interopRequireDefault(_errorHandler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Create the service.
var Service = function () {
  function Service(options) {
    _classCallCheck(this, Service);

    if (!options) {
      throw new Error('MongoDB options have to be provided');
    }

    this.Model = options.Model;
    this.id = options.id || '_id';
    this.events = options.events || [];
    this.paginate = options.paginate || {};
  }

  _createClass(Service, [{
    key: 'extend',
    value: function extend(obj) {
      return _uberproto2.default.extend(obj, this);
    }
  }, {
    key: '_objectifyId',
    value: function _objectifyId(id) {
      if (this.id === '_id' && _mongodb.ObjectID.isValid(id)) {
        id = new _mongodb.ObjectID(id.toString());
      }

      return id;
    }
  }, {
    key: '_multiOptions',
    value: function _multiOptions(id, params) {
      var query = (0, _feathersQueryFilters2.default)(params.query || {}).query;
      var options = Object.assign({ multi: true }, params.mongodb || params.options);

      if (id !== null) {
        options.multi = false;
        query[this.id] = this._objectifyId(id);
      }

      return { query: query, options: options };
    }
  }, {
    key: '_getSelect',
    value: function _getSelect(select) {
      if (Array.isArray(select)) {
        var result = {};
        select.forEach(function (name) {
          result[name] = 1;
        });
        return result;
      }

      return select;
    }
  }, {
    key: '_find',
    value: function _find(params, count) {
      var getFilter = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : _feathersQueryFilters2.default;

      // Start with finding all, and limit when necessary.
      var _getFilter = getFilter(params.query || {}),
          filters = _getFilter.filters,
          query = _getFilter.query;

      // Objectify the id field if it's present


      if (query[this.id]) {
        query[this.id] = this._objectifyId(query[this.id]);
      }

      var q = this.Model.find(query);

      if (filters.$select) {
        q = this.Model.find(query, this._getSelect(filters.$select));
      }

      if (filters.$sort) {
        q.sort(filters.$sort);
      }

      if (params.collation) {
        q.collation(params.collation);
      }

      if (filters.$limit) {
        q.limit(filters.$limit);
      }

      if (filters.$skip) {
        q.skip(filters.$skip);
      }

      var runQuery = function runQuery(total) {
        return q.toArray().then(function (data) {
          return {
            total: total,
            limit: filters.$limit,
            skip: filters.$skip || 0,
            data: data
          };
        });
      };

      if (filters.$limit === 0) {
        runQuery = function runQuery(total) {
          return Promise.resolve({
            total: total,
            limit: filters.$limit,
            skip: filters.$skip || 0,
            data: []
          });
        };
      }

      if (count) {
        return this.Model.count(query).then(runQuery);
      }

      return runQuery();
    }
  }, {
    key: 'find',
    value: function find(params) {
      var paginate = params && typeof params.paginate !== 'undefined' ? params.paginate : this.paginate;
      var result = this._find(params, !!paginate.default, function (query) {
        return (0, _feathersQueryFilters2.default)(query, paginate);
      });

      if (!paginate.default) {
        return result.then(function (page) {
          return page.data;
        });
      }

      return result;
    }
  }, {
    key: '_get',
    value: function _get(id, params) {
      id = this._objectifyId(id);

      return this.Model.findOne(_defineProperty({}, this.id, id)).then(function (data) {
        if (!data) {
          throw new _feathersErrors2.default.NotFound('No record found for id \'' + id + '\'');
        }

        return data;
      }).then((0, _feathersCommons.select)(params, this.id)).catch(_errorHandler2.default);
    }
  }, {
    key: 'get',
    value: function get(id, params) {
      return this._get(id, params);
    }
  }, {
    key: '_findOrGet',
    value: function _findOrGet(id, params) {
      if (id === null) {
        return this._find(params).then(function (page) {
          return page.data;
        });
      }

      return this._get(id, params);
    }
  }, {
    key: 'create',
    value: function create(data, params) {
      var _this = this;

      var setId = function setId(item) {
        var entry = Object.assign({}, item);

        // Generate a MongoId if we use a custom id
        if (_this.id !== '_id' && typeof entry[_this.id] === 'undefined') {
          entry[_this.id] = new _mongodb.ObjectID().toHexString();
        }

        return entry;
      };

      return this.Model.insertOne(Array.isArray(data) ? data.map(setId) : setId(data)).then((0, _feathersCommons.select)(params, this.id)).catch(_errorHandler2.default);
    }
  }, {
    key: '_normalizeId',
    value: function _normalizeId(id, data) {
      if (this.id === '_id') {
        // Default Mongo IDs cannot be updated. The Mongo library handles
        // this automatically.
        return (0, _lodash2.default)(data, this.id);
      } else if (id !== null) {
        // If not using the default Mongo _id field set the ID to its
        // previous value. This prevents orphaned documents.
        return Object.assign({}, data, _defineProperty({}, this.id, id));
      } else {
        return data;
      }
    }
  }, {
    key: 'patch',
    value: function patch(id, data, params) {
      var _this2 = this;

      var _multiOptions2 = this._multiOptions(id, params),
          query = _multiOptions2.query,
          options = _multiOptions2.options;

      var mapIds = function mapIds(page) {
        return page.data.map(function (current) {
          return current[_this2.id];
        });
      };

      // By default we will just query for the one id. For multi patch
      // we create a list of the ids of all items that will be changed
      // to re-query them after the update
      var ids = id === null ? this._find(params).then(mapIds) : Promise.resolve([id]);

      if (params.collation) {
        query = Object.assign(query, { collation: params.collation });
      }

      // Run the query
      return ids.then(function (idList) {
        // Create a new query that re-queries all ids that
        // were originally changed
        var findParams = Object.assign({}, params, {
          query: _defineProperty({}, _this2.id, { $in: idList })
        });

        return _this2.Model.update(query, { $set: _this2._normalizeId(id, data) }, options).then(function () {
          return _this2._findOrGet(id, findParams);
        });
      }).then((0, _feathersCommons.select)(params, this.id)).catch(_errorHandler2.default);
    }
  }, {
    key: 'update',
    value: function update(id, data, params) {
      var _this3 = this;

      if (Array.isArray(data) || id === null) {
        return Promise.reject(new _feathersErrors2.default.BadRequest('Not replacing multiple records. Did you mean `patch`?'));
      }

      var _multiOptions3 = this._multiOptions(id, params),
          query = _multiOptions3.query,
          options = _multiOptions3.options;

      return this.Model.replaceOne(query, this._normalizeId(id, data), options).then(function () {
        return _this3._findOrGet(id);
      }).then((0, _feathersCommons.select)(params, this.id)).catch(_errorHandler2.default);
    }
  }, {
    key: 'remove',
    value: function remove(id, params) {
      var _this4 = this;

      var _multiOptions4 = this._multiOptions(id, params),
          query = _multiOptions4.query,
          options = _multiOptions4.options;

      if (params.collation) {
        query = Object.assign(query, { collation: params.collation });
      }

      return this._findOrGet(id, params).then(function (items) {
        return _this4.Model.remove(query, options).then(function () {
          return items;
        }).then((0, _feathersCommons.select)(params, _this4.id));
      }).catch(_errorHandler2.default);
    }
  }]);

  return Service;
}();

function init(options) {
  return new Service(options);
}

init.Service = Service;
module.exports = exports['default'];