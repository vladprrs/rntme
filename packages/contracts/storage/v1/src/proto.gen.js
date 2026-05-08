/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import $protobuf from "protobufjs/minimal.js";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const rntme = $root.rntme = (() => {

    /**
     * Namespace rntme.
     * @exports rntme
     * @namespace
     */
    const rntme = {};

    rntme.contracts = (function() {

        /**
         * Namespace contracts.
         * @memberof rntme
         * @namespace
         */
        const contracts = {};

        contracts.storage = (function() {

            /**
             * Namespace storage.
             * @memberof rntme.contracts
             * @namespace
             */
            const storage = {};

            storage.v1 = (function() {

                /**
                 * Namespace v1.
                 * @memberof rntme.contracts.storage
                 * @namespace
                 */
                const v1 = {};

                v1.FileUploadInitiated = (function() {

                    /**
                     * Properties of a FileUploadInitiated.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IFileUploadInitiated
                     * @property {string|null} [file_id] FileUploadInitiated file_id
                     * @property {string|null} [route_id] FileUploadInitiated route_id
                     * @property {string|null} [entity_id] FileUploadInitiated entity_id
                     * @property {string|null} [owner_principal_id] FileUploadInitiated owner_principal_id
                     * @property {string|null} [content_type] FileUploadInitiated content_type
                     * @property {number|Long|null} [declared_size] FileUploadInitiated declared_size
                     * @property {google.protobuf.ITimestamp|null} [expires_at] FileUploadInitiated expires_at
                     */

                    /**
                     * Constructs a new FileUploadInitiated.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a FileUploadInitiated.
                     * @implements IFileUploadInitiated
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IFileUploadInitiated=} [properties] Properties to set
                     */
                    function FileUploadInitiated(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * FileUploadInitiated file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @instance
                     */
                    FileUploadInitiated.prototype.file_id = "";

                    /**
                     * FileUploadInitiated route_id.
                     * @member {string} route_id
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @instance
                     */
                    FileUploadInitiated.prototype.route_id = "";

                    /**
                     * FileUploadInitiated entity_id.
                     * @member {string} entity_id
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @instance
                     */
                    FileUploadInitiated.prototype.entity_id = "";

                    /**
                     * FileUploadInitiated owner_principal_id.
                     * @member {string} owner_principal_id
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @instance
                     */
                    FileUploadInitiated.prototype.owner_principal_id = "";

                    /**
                     * FileUploadInitiated content_type.
                     * @member {string} content_type
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @instance
                     */
                    FileUploadInitiated.prototype.content_type = "";

                    /**
                     * FileUploadInitiated declared_size.
                     * @member {number|Long} declared_size
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @instance
                     */
                    FileUploadInitiated.prototype.declared_size = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                    /**
                     * FileUploadInitiated expires_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} expires_at
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @instance
                     */
                    FileUploadInitiated.prototype.expires_at = null;

                    /**
                     * Creates a new FileUploadInitiated instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileUploadInitiated=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.FileUploadInitiated} FileUploadInitiated instance
                     */
                    FileUploadInitiated.create = function create(properties) {
                        return new FileUploadInitiated(properties);
                    };

                    /**
                     * Encodes the specified FileUploadInitiated message. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadInitiated.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileUploadInitiated} message FileUploadInitiated message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileUploadInitiated.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.file_id);
                        if (message.route_id != null && Object.hasOwnProperty.call(message, "route_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.route_id);
                        if (message.entity_id != null && Object.hasOwnProperty.call(message, "entity_id"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.entity_id);
                        if (message.owner_principal_id != null && Object.hasOwnProperty.call(message, "owner_principal_id"))
                            writer.uint32(/* id 4, wireType 2 =*/34).string(message.owner_principal_id);
                        if (message.content_type != null && Object.hasOwnProperty.call(message, "content_type"))
                            writer.uint32(/* id 5, wireType 2 =*/42).string(message.content_type);
                        if (message.declared_size != null && Object.hasOwnProperty.call(message, "declared_size"))
                            writer.uint32(/* id 6, wireType 0 =*/48).int64(message.declared_size);
                        if (message.expires_at != null && Object.hasOwnProperty.call(message, "expires_at"))
                            $root.google.protobuf.Timestamp.encode(message.expires_at, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified FileUploadInitiated message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadInitiated.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileUploadInitiated} message FileUploadInitiated message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileUploadInitiated.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a FileUploadInitiated message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.FileUploadInitiated} FileUploadInitiated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileUploadInitiated.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.FileUploadInitiated();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.route_id = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.entity_id = reader.string();
                                    break;
                                }
                            case 4: {
                                    message.owner_principal_id = reader.string();
                                    break;
                                }
                            case 5: {
                                    message.content_type = reader.string();
                                    break;
                                }
                            case 6: {
                                    message.declared_size = reader.int64();
                                    break;
                                }
                            case 7: {
                                    message.expires_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a FileUploadInitiated message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.FileUploadInitiated} FileUploadInitiated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileUploadInitiated.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a FileUploadInitiated message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    FileUploadInitiated.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        if (message.route_id != null && message.hasOwnProperty("route_id"))
                            if (!$util.isString(message.route_id))
                                return "route_id: string expected";
                        if (message.entity_id != null && message.hasOwnProperty("entity_id"))
                            if (!$util.isString(message.entity_id))
                                return "entity_id: string expected";
                        if (message.owner_principal_id != null && message.hasOwnProperty("owner_principal_id"))
                            if (!$util.isString(message.owner_principal_id))
                                return "owner_principal_id: string expected";
                        if (message.content_type != null && message.hasOwnProperty("content_type"))
                            if (!$util.isString(message.content_type))
                                return "content_type: string expected";
                        if (message.declared_size != null && message.hasOwnProperty("declared_size"))
                            if (!$util.isInteger(message.declared_size) && !(message.declared_size && $util.isInteger(message.declared_size.low) && $util.isInteger(message.declared_size.high)))
                                return "declared_size: integer|Long expected";
                        if (message.expires_at != null && message.hasOwnProperty("expires_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.expires_at);
                            if (error)
                                return "expires_at." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a FileUploadInitiated message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.FileUploadInitiated} FileUploadInitiated
                     */
                    FileUploadInitiated.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.FileUploadInitiated)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.FileUploadInitiated();
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        if (object.route_id != null)
                            message.route_id = String(object.route_id);
                        if (object.entity_id != null)
                            message.entity_id = String(object.entity_id);
                        if (object.owner_principal_id != null)
                            message.owner_principal_id = String(object.owner_principal_id);
                        if (object.content_type != null)
                            message.content_type = String(object.content_type);
                        if (object.declared_size != null)
                            if ($util.Long)
                                (message.declared_size = $util.Long.fromValue(object.declared_size)).unsigned = false;
                            else if (typeof object.declared_size === "string")
                                message.declared_size = parseInt(object.declared_size, 10);
                            else if (typeof object.declared_size === "number")
                                message.declared_size = object.declared_size;
                            else if (typeof object.declared_size === "object")
                                message.declared_size = new $util.LongBits(object.declared_size.low >>> 0, object.declared_size.high >>> 0).toNumber();
                        if (object.expires_at != null) {
                            if (typeof object.expires_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileUploadInitiated.expires_at: object expected");
                            message.expires_at = $root.google.protobuf.Timestamp.fromObject(object.expires_at);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a FileUploadInitiated message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @static
                     * @param {rntme.contracts.storage.v1.FileUploadInitiated} message FileUploadInitiated
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    FileUploadInitiated.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.file_id = "";
                            object.route_id = "";
                            object.entity_id = "";
                            object.owner_principal_id = "";
                            object.content_type = "";
                            if ($util.Long) {
                                let long = new $util.Long(0, 0, false);
                                object.declared_size = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                            } else
                                object.declared_size = options.longs === String ? "0" : 0;
                            object.expires_at = null;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        if (message.route_id != null && message.hasOwnProperty("route_id"))
                            object.route_id = message.route_id;
                        if (message.entity_id != null && message.hasOwnProperty("entity_id"))
                            object.entity_id = message.entity_id;
                        if (message.owner_principal_id != null && message.hasOwnProperty("owner_principal_id"))
                            object.owner_principal_id = message.owner_principal_id;
                        if (message.content_type != null && message.hasOwnProperty("content_type"))
                            object.content_type = message.content_type;
                        if (message.declared_size != null && message.hasOwnProperty("declared_size"))
                            if (typeof message.declared_size === "number")
                                object.declared_size = options.longs === String ? String(message.declared_size) : message.declared_size;
                            else
                                object.declared_size = options.longs === String ? $util.Long.prototype.toString.call(message.declared_size) : options.longs === Number ? new $util.LongBits(message.declared_size.low >>> 0, message.declared_size.high >>> 0).toNumber() : message.declared_size;
                        if (message.expires_at != null && message.hasOwnProperty("expires_at"))
                            object.expires_at = $root.google.protobuf.Timestamp.toObject(message.expires_at, options);
                        return object;
                    };

                    /**
                     * Converts this FileUploadInitiated to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    FileUploadInitiated.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for FileUploadInitiated
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.FileUploadInitiated
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    FileUploadInitiated.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.FileUploadInitiated";
                    };

                    return FileUploadInitiated;
                })();

                v1.FileUploadCommitted = (function() {

                    /**
                     * Properties of a FileUploadCommitted.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IFileUploadCommitted
                     * @property {string|null} [file_id] FileUploadCommitted file_id
                     * @property {string|null} [object_key] FileUploadCommitted object_key
                     * @property {string|null} [sha256] FileUploadCommitted sha256
                     * @property {number|Long|null} [size_bytes] FileUploadCommitted size_bytes
                     * @property {google.protobuf.ITimestamp|null} [committed_at] FileUploadCommitted committed_at
                     */

                    /**
                     * Constructs a new FileUploadCommitted.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a FileUploadCommitted.
                     * @implements IFileUploadCommitted
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IFileUploadCommitted=} [properties] Properties to set
                     */
                    function FileUploadCommitted(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * FileUploadCommitted file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @instance
                     */
                    FileUploadCommitted.prototype.file_id = "";

                    /**
                     * FileUploadCommitted object_key.
                     * @member {string} object_key
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @instance
                     */
                    FileUploadCommitted.prototype.object_key = "";

                    /**
                     * FileUploadCommitted sha256.
                     * @member {string} sha256
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @instance
                     */
                    FileUploadCommitted.prototype.sha256 = "";

                    /**
                     * FileUploadCommitted size_bytes.
                     * @member {number|Long} size_bytes
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @instance
                     */
                    FileUploadCommitted.prototype.size_bytes = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                    /**
                     * FileUploadCommitted committed_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} committed_at
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @instance
                     */
                    FileUploadCommitted.prototype.committed_at = null;

                    /**
                     * Creates a new FileUploadCommitted instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileUploadCommitted=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.FileUploadCommitted} FileUploadCommitted instance
                     */
                    FileUploadCommitted.create = function create(properties) {
                        return new FileUploadCommitted(properties);
                    };

                    /**
                     * Encodes the specified FileUploadCommitted message. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadCommitted.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileUploadCommitted} message FileUploadCommitted message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileUploadCommitted.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.file_id);
                        if (message.object_key != null && Object.hasOwnProperty.call(message, "object_key"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.object_key);
                        if (message.sha256 != null && Object.hasOwnProperty.call(message, "sha256"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.sha256);
                        if (message.size_bytes != null && Object.hasOwnProperty.call(message, "size_bytes"))
                            writer.uint32(/* id 4, wireType 0 =*/32).int64(message.size_bytes);
                        if (message.committed_at != null && Object.hasOwnProperty.call(message, "committed_at"))
                            $root.google.protobuf.Timestamp.encode(message.committed_at, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified FileUploadCommitted message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadCommitted.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileUploadCommitted} message FileUploadCommitted message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileUploadCommitted.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a FileUploadCommitted message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.FileUploadCommitted} FileUploadCommitted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileUploadCommitted.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.FileUploadCommitted();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.object_key = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.sha256 = reader.string();
                                    break;
                                }
                            case 4: {
                                    message.size_bytes = reader.int64();
                                    break;
                                }
                            case 5: {
                                    message.committed_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a FileUploadCommitted message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.FileUploadCommitted} FileUploadCommitted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileUploadCommitted.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a FileUploadCommitted message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    FileUploadCommitted.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        if (message.object_key != null && message.hasOwnProperty("object_key"))
                            if (!$util.isString(message.object_key))
                                return "object_key: string expected";
                        if (message.sha256 != null && message.hasOwnProperty("sha256"))
                            if (!$util.isString(message.sha256))
                                return "sha256: string expected";
                        if (message.size_bytes != null && message.hasOwnProperty("size_bytes"))
                            if (!$util.isInteger(message.size_bytes) && !(message.size_bytes && $util.isInteger(message.size_bytes.low) && $util.isInteger(message.size_bytes.high)))
                                return "size_bytes: integer|Long expected";
                        if (message.committed_at != null && message.hasOwnProperty("committed_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.committed_at);
                            if (error)
                                return "committed_at." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a FileUploadCommitted message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.FileUploadCommitted} FileUploadCommitted
                     */
                    FileUploadCommitted.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.FileUploadCommitted)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.FileUploadCommitted();
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        if (object.object_key != null)
                            message.object_key = String(object.object_key);
                        if (object.sha256 != null)
                            message.sha256 = String(object.sha256);
                        if (object.size_bytes != null)
                            if ($util.Long)
                                (message.size_bytes = $util.Long.fromValue(object.size_bytes)).unsigned = false;
                            else if (typeof object.size_bytes === "string")
                                message.size_bytes = parseInt(object.size_bytes, 10);
                            else if (typeof object.size_bytes === "number")
                                message.size_bytes = object.size_bytes;
                            else if (typeof object.size_bytes === "object")
                                message.size_bytes = new $util.LongBits(object.size_bytes.low >>> 0, object.size_bytes.high >>> 0).toNumber();
                        if (object.committed_at != null) {
                            if (typeof object.committed_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileUploadCommitted.committed_at: object expected");
                            message.committed_at = $root.google.protobuf.Timestamp.fromObject(object.committed_at);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a FileUploadCommitted message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @static
                     * @param {rntme.contracts.storage.v1.FileUploadCommitted} message FileUploadCommitted
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    FileUploadCommitted.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.file_id = "";
                            object.object_key = "";
                            object.sha256 = "";
                            if ($util.Long) {
                                let long = new $util.Long(0, 0, false);
                                object.size_bytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                            } else
                                object.size_bytes = options.longs === String ? "0" : 0;
                            object.committed_at = null;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        if (message.object_key != null && message.hasOwnProperty("object_key"))
                            object.object_key = message.object_key;
                        if (message.sha256 != null && message.hasOwnProperty("sha256"))
                            object.sha256 = message.sha256;
                        if (message.size_bytes != null && message.hasOwnProperty("size_bytes"))
                            if (typeof message.size_bytes === "number")
                                object.size_bytes = options.longs === String ? String(message.size_bytes) : message.size_bytes;
                            else
                                object.size_bytes = options.longs === String ? $util.Long.prototype.toString.call(message.size_bytes) : options.longs === Number ? new $util.LongBits(message.size_bytes.low >>> 0, message.size_bytes.high >>> 0).toNumber() : message.size_bytes;
                        if (message.committed_at != null && message.hasOwnProperty("committed_at"))
                            object.committed_at = $root.google.protobuf.Timestamp.toObject(message.committed_at, options);
                        return object;
                    };

                    /**
                     * Converts this FileUploadCommitted to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    FileUploadCommitted.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for FileUploadCommitted
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.FileUploadCommitted
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    FileUploadCommitted.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.FileUploadCommitted";
                    };

                    return FileUploadCommitted;
                })();

                v1.FileUploadAborted = (function() {

                    /**
                     * Properties of a FileUploadAborted.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IFileUploadAborted
                     * @property {string|null} [file_id] FileUploadAborted file_id
                     * @property {string|null} [reason] FileUploadAborted reason
                     * @property {google.protobuf.ITimestamp|null} [aborted_at] FileUploadAborted aborted_at
                     */

                    /**
                     * Constructs a new FileUploadAborted.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a FileUploadAborted.
                     * @implements IFileUploadAborted
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IFileUploadAborted=} [properties] Properties to set
                     */
                    function FileUploadAborted(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * FileUploadAborted file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @instance
                     */
                    FileUploadAborted.prototype.file_id = "";

                    /**
                     * FileUploadAborted reason.
                     * @member {string} reason
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @instance
                     */
                    FileUploadAborted.prototype.reason = "";

                    /**
                     * FileUploadAborted aborted_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} aborted_at
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @instance
                     */
                    FileUploadAborted.prototype.aborted_at = null;

                    /**
                     * Creates a new FileUploadAborted instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileUploadAborted=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.FileUploadAborted} FileUploadAborted instance
                     */
                    FileUploadAborted.create = function create(properties) {
                        return new FileUploadAborted(properties);
                    };

                    /**
                     * Encodes the specified FileUploadAborted message. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadAborted.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileUploadAborted} message FileUploadAborted message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileUploadAborted.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.file_id);
                        if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.reason);
                        if (message.aborted_at != null && Object.hasOwnProperty.call(message, "aborted_at"))
                            $root.google.protobuf.Timestamp.encode(message.aborted_at, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified FileUploadAborted message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileUploadAborted.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileUploadAborted} message FileUploadAborted message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileUploadAborted.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a FileUploadAborted message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.FileUploadAborted} FileUploadAborted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileUploadAborted.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.FileUploadAborted();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.reason = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.aborted_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a FileUploadAborted message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.FileUploadAborted} FileUploadAborted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileUploadAborted.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a FileUploadAborted message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    FileUploadAborted.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        if (message.reason != null && message.hasOwnProperty("reason"))
                            if (!$util.isString(message.reason))
                                return "reason: string expected";
                        if (message.aborted_at != null && message.hasOwnProperty("aborted_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.aborted_at);
                            if (error)
                                return "aborted_at." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a FileUploadAborted message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.FileUploadAborted} FileUploadAborted
                     */
                    FileUploadAborted.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.FileUploadAborted)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.FileUploadAborted();
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        if (object.reason != null)
                            message.reason = String(object.reason);
                        if (object.aborted_at != null) {
                            if (typeof object.aborted_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileUploadAborted.aborted_at: object expected");
                            message.aborted_at = $root.google.protobuf.Timestamp.fromObject(object.aborted_at);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a FileUploadAborted message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @static
                     * @param {rntme.contracts.storage.v1.FileUploadAborted} message FileUploadAborted
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    FileUploadAborted.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.file_id = "";
                            object.reason = "";
                            object.aborted_at = null;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        if (message.reason != null && message.hasOwnProperty("reason"))
                            object.reason = message.reason;
                        if (message.aborted_at != null && message.hasOwnProperty("aborted_at"))
                            object.aborted_at = $root.google.protobuf.Timestamp.toObject(message.aborted_at, options);
                        return object;
                    };

                    /**
                     * Converts this FileUploadAborted to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    FileUploadAborted.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for FileUploadAborted
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.FileUploadAborted
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    FileUploadAborted.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.FileUploadAborted";
                    };

                    return FileUploadAborted;
                })();

                v1.FileOrphaned = (function() {

                    /**
                     * Properties of a FileOrphaned.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IFileOrphaned
                     * @property {string|null} [file_id] FileOrphaned file_id
                     * @property {string|null} [reason] FileOrphaned reason
                     * @property {google.protobuf.ITimestamp|null} [orphaned_at] FileOrphaned orphaned_at
                     */

                    /**
                     * Constructs a new FileOrphaned.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a FileOrphaned.
                     * @implements IFileOrphaned
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IFileOrphaned=} [properties] Properties to set
                     */
                    function FileOrphaned(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * FileOrphaned file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @instance
                     */
                    FileOrphaned.prototype.file_id = "";

                    /**
                     * FileOrphaned reason.
                     * @member {string} reason
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @instance
                     */
                    FileOrphaned.prototype.reason = "";

                    /**
                     * FileOrphaned orphaned_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} orphaned_at
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @instance
                     */
                    FileOrphaned.prototype.orphaned_at = null;

                    /**
                     * Creates a new FileOrphaned instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileOrphaned=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.FileOrphaned} FileOrphaned instance
                     */
                    FileOrphaned.create = function create(properties) {
                        return new FileOrphaned(properties);
                    };

                    /**
                     * Encodes the specified FileOrphaned message. Does not implicitly {@link rntme.contracts.storage.v1.FileOrphaned.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileOrphaned} message FileOrphaned message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileOrphaned.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.file_id);
                        if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.reason);
                        if (message.orphaned_at != null && Object.hasOwnProperty.call(message, "orphaned_at"))
                            $root.google.protobuf.Timestamp.encode(message.orphaned_at, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified FileOrphaned message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileOrphaned.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileOrphaned} message FileOrphaned message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileOrphaned.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a FileOrphaned message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.FileOrphaned} FileOrphaned
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileOrphaned.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.FileOrphaned();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.reason = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.orphaned_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a FileOrphaned message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.FileOrphaned} FileOrphaned
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileOrphaned.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a FileOrphaned message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    FileOrphaned.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        if (message.reason != null && message.hasOwnProperty("reason"))
                            if (!$util.isString(message.reason))
                                return "reason: string expected";
                        if (message.orphaned_at != null && message.hasOwnProperty("orphaned_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.orphaned_at);
                            if (error)
                                return "orphaned_at." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a FileOrphaned message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.FileOrphaned} FileOrphaned
                     */
                    FileOrphaned.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.FileOrphaned)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.FileOrphaned();
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        if (object.reason != null)
                            message.reason = String(object.reason);
                        if (object.orphaned_at != null) {
                            if (typeof object.orphaned_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileOrphaned.orphaned_at: object expected");
                            message.orphaned_at = $root.google.protobuf.Timestamp.fromObject(object.orphaned_at);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a FileOrphaned message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @static
                     * @param {rntme.contracts.storage.v1.FileOrphaned} message FileOrphaned
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    FileOrphaned.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.file_id = "";
                            object.reason = "";
                            object.orphaned_at = null;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        if (message.reason != null && message.hasOwnProperty("reason"))
                            object.reason = message.reason;
                        if (message.orphaned_at != null && message.hasOwnProperty("orphaned_at"))
                            object.orphaned_at = $root.google.protobuf.Timestamp.toObject(message.orphaned_at, options);
                        return object;
                    };

                    /**
                     * Converts this FileOrphaned to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    FileOrphaned.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for FileOrphaned
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.FileOrphaned
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    FileOrphaned.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.FileOrphaned";
                    };

                    return FileOrphaned;
                })();

                v1.FileDeleted = (function() {

                    /**
                     * Properties of a FileDeleted.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IFileDeleted
                     * @property {string|null} [file_id] FileDeleted file_id
                     * @property {string|null} [deleted_by] FileDeleted deleted_by
                     * @property {google.protobuf.ITimestamp|null} [deleted_at] FileDeleted deleted_at
                     */

                    /**
                     * Constructs a new FileDeleted.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a FileDeleted.
                     * @implements IFileDeleted
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IFileDeleted=} [properties] Properties to set
                     */
                    function FileDeleted(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * FileDeleted file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @instance
                     */
                    FileDeleted.prototype.file_id = "";

                    /**
                     * FileDeleted deleted_by.
                     * @member {string} deleted_by
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @instance
                     */
                    FileDeleted.prototype.deleted_by = "";

                    /**
                     * FileDeleted deleted_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} deleted_at
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @instance
                     */
                    FileDeleted.prototype.deleted_at = null;

                    /**
                     * Creates a new FileDeleted instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileDeleted=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.FileDeleted} FileDeleted instance
                     */
                    FileDeleted.create = function create(properties) {
                        return new FileDeleted(properties);
                    };

                    /**
                     * Encodes the specified FileDeleted message. Does not implicitly {@link rntme.contracts.storage.v1.FileDeleted.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileDeleted} message FileDeleted message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileDeleted.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.file_id);
                        if (message.deleted_by != null && Object.hasOwnProperty.call(message, "deleted_by"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.deleted_by);
                        if (message.deleted_at != null && Object.hasOwnProperty.call(message, "deleted_at"))
                            $root.google.protobuf.Timestamp.encode(message.deleted_at, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified FileDeleted message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileDeleted.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileDeleted} message FileDeleted message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileDeleted.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a FileDeleted message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.FileDeleted} FileDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileDeleted.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.FileDeleted();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.deleted_by = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.deleted_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a FileDeleted message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.FileDeleted} FileDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileDeleted.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a FileDeleted message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    FileDeleted.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        if (message.deleted_by != null && message.hasOwnProperty("deleted_by"))
                            if (!$util.isString(message.deleted_by))
                                return "deleted_by: string expected";
                        if (message.deleted_at != null && message.hasOwnProperty("deleted_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.deleted_at);
                            if (error)
                                return "deleted_at." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a FileDeleted message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.FileDeleted} FileDeleted
                     */
                    FileDeleted.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.FileDeleted)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.FileDeleted();
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        if (object.deleted_by != null)
                            message.deleted_by = String(object.deleted_by);
                        if (object.deleted_at != null) {
                            if (typeof object.deleted_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileDeleted.deleted_at: object expected");
                            message.deleted_at = $root.google.protobuf.Timestamp.fromObject(object.deleted_at);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a FileDeleted message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @static
                     * @param {rntme.contracts.storage.v1.FileDeleted} message FileDeleted
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    FileDeleted.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.file_id = "";
                            object.deleted_by = "";
                            object.deleted_at = null;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        if (message.deleted_by != null && message.hasOwnProperty("deleted_by"))
                            object.deleted_by = message.deleted_by;
                        if (message.deleted_at != null && message.hasOwnProperty("deleted_at"))
                            object.deleted_at = $root.google.protobuf.Timestamp.toObject(message.deleted_at, options);
                        return object;
                    };

                    /**
                     * Converts this FileDeleted to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    FileDeleted.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for FileDeleted
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.FileDeleted
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    FileDeleted.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.FileDeleted";
                    };

                    return FileDeleted;
                })();

                v1.FileLifecycleSwept = (function() {

                    /**
                     * Properties of a FileLifecycleSwept.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IFileLifecycleSwept
                     * @property {number|null} [count] FileLifecycleSwept count
                     * @property {google.protobuf.ITimestamp|null} [before_at] FileLifecycleSwept before_at
                     * @property {Array.<string>|null} [file_ids_sample] FileLifecycleSwept file_ids_sample
                     */

                    /**
                     * Constructs a new FileLifecycleSwept.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a FileLifecycleSwept.
                     * @implements IFileLifecycleSwept
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IFileLifecycleSwept=} [properties] Properties to set
                     */
                    function FileLifecycleSwept(properties) {
                        this.file_ids_sample = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * FileLifecycleSwept count.
                     * @member {number} count
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @instance
                     */
                    FileLifecycleSwept.prototype.count = 0;

                    /**
                     * FileLifecycleSwept before_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} before_at
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @instance
                     */
                    FileLifecycleSwept.prototype.before_at = null;

                    /**
                     * FileLifecycleSwept file_ids_sample.
                     * @member {Array.<string>} file_ids_sample
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @instance
                     */
                    FileLifecycleSwept.prototype.file_ids_sample = $util.emptyArray;

                    /**
                     * Creates a new FileLifecycleSwept instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileLifecycleSwept=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.FileLifecycleSwept} FileLifecycleSwept instance
                     */
                    FileLifecycleSwept.create = function create(properties) {
                        return new FileLifecycleSwept(properties);
                    };

                    /**
                     * Encodes the specified FileLifecycleSwept message. Does not implicitly {@link rntme.contracts.storage.v1.FileLifecycleSwept.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileLifecycleSwept} message FileLifecycleSwept message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileLifecycleSwept.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.count != null && Object.hasOwnProperty.call(message, "count"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.count);
                        if (message.before_at != null && Object.hasOwnProperty.call(message, "before_at"))
                            $root.google.protobuf.Timestamp.encode(message.before_at, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.file_ids_sample != null && message.file_ids_sample.length)
                            for (let i = 0; i < message.file_ids_sample.length; ++i)
                                writer.uint32(/* id 3, wireType 2 =*/26).string(message.file_ids_sample[i]);
                        return writer;
                    };

                    /**
                     * Encodes the specified FileLifecycleSwept message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileLifecycleSwept.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileLifecycleSwept} message FileLifecycleSwept message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileLifecycleSwept.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a FileLifecycleSwept message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.FileLifecycleSwept} FileLifecycleSwept
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileLifecycleSwept.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.FileLifecycleSwept();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.count = reader.int32();
                                    break;
                                }
                            case 2: {
                                    message.before_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            case 3: {
                                    if (!(message.file_ids_sample && message.file_ids_sample.length))
                                        message.file_ids_sample = [];
                                    message.file_ids_sample.push(reader.string());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a FileLifecycleSwept message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.FileLifecycleSwept} FileLifecycleSwept
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileLifecycleSwept.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a FileLifecycleSwept message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    FileLifecycleSwept.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.count != null && message.hasOwnProperty("count"))
                            if (!$util.isInteger(message.count))
                                return "count: integer expected";
                        if (message.before_at != null && message.hasOwnProperty("before_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.before_at);
                            if (error)
                                return "before_at." + error;
                        }
                        if (message.file_ids_sample != null && message.hasOwnProperty("file_ids_sample")) {
                            if (!Array.isArray(message.file_ids_sample))
                                return "file_ids_sample: array expected";
                            for (let i = 0; i < message.file_ids_sample.length; ++i)
                                if (!$util.isString(message.file_ids_sample[i]))
                                    return "file_ids_sample: string[] expected";
                        }
                        return null;
                    };

                    /**
                     * Creates a FileLifecycleSwept message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.FileLifecycleSwept} FileLifecycleSwept
                     */
                    FileLifecycleSwept.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.FileLifecycleSwept)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.FileLifecycleSwept();
                        if (object.count != null)
                            message.count = object.count | 0;
                        if (object.before_at != null) {
                            if (typeof object.before_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileLifecycleSwept.before_at: object expected");
                            message.before_at = $root.google.protobuf.Timestamp.fromObject(object.before_at);
                        }
                        if (object.file_ids_sample) {
                            if (!Array.isArray(object.file_ids_sample))
                                throw TypeError(".rntme.contracts.storage.v1.FileLifecycleSwept.file_ids_sample: array expected");
                            message.file_ids_sample = [];
                            for (let i = 0; i < object.file_ids_sample.length; ++i)
                                message.file_ids_sample[i] = String(object.file_ids_sample[i]);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a FileLifecycleSwept message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @static
                     * @param {rntme.contracts.storage.v1.FileLifecycleSwept} message FileLifecycleSwept
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    FileLifecycleSwept.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.file_ids_sample = [];
                        if (options.defaults) {
                            object.count = 0;
                            object.before_at = null;
                        }
                        if (message.count != null && message.hasOwnProperty("count"))
                            object.count = message.count;
                        if (message.before_at != null && message.hasOwnProperty("before_at"))
                            object.before_at = $root.google.protobuf.Timestamp.toObject(message.before_at, options);
                        if (message.file_ids_sample && message.file_ids_sample.length) {
                            object.file_ids_sample = [];
                            for (let j = 0; j < message.file_ids_sample.length; ++j)
                                object.file_ids_sample[j] = message.file_ids_sample[j];
                        }
                        return object;
                    };

                    /**
                     * Converts this FileLifecycleSwept to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    FileLifecycleSwept.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for FileLifecycleSwept
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.FileLifecycleSwept
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    FileLifecycleSwept.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.FileLifecycleSwept";
                    };

                    return FileLifecycleSwept;
                })();

                /**
                 * FileState enum.
                 * @name rntme.contracts.storage.v1.FileState
                 * @enum {number}
                 * @property {number} FILE_STATE_UNSPECIFIED=0 FILE_STATE_UNSPECIFIED value
                 * @property {number} FILE_STATE_PENDING=1 FILE_STATE_PENDING value
                 * @property {number} FILE_STATE_COMMITTED=2 FILE_STATE_COMMITTED value
                 * @property {number} FILE_STATE_ABORTED=3 FILE_STATE_ABORTED value
                 * @property {number} FILE_STATE_DELETED=4 FILE_STATE_DELETED value
                 * @property {number} FILE_STATE_VENDOR_SPECIFIC=100 FILE_STATE_VENDOR_SPECIFIC value
                 */
                v1.FileState = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "FILE_STATE_UNSPECIFIED"] = 0;
                    values[valuesById[1] = "FILE_STATE_PENDING"] = 1;
                    values[valuesById[2] = "FILE_STATE_COMMITTED"] = 2;
                    values[valuesById[3] = "FILE_STATE_ABORTED"] = 3;
                    values[valuesById[4] = "FILE_STATE_DELETED"] = 4;
                    values[valuesById[100] = "FILE_STATE_VENDOR_SPECIFIC"] = 100;
                    return values;
                })();

                v1.FileMetadata = (function() {

                    /**
                     * Properties of a FileMetadata.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IFileMetadata
                     * @property {string|null} [file_id] FileMetadata file_id
                     * @property {string|null} [route_id] FileMetadata route_id
                     * @property {string|null} [entity_id] FileMetadata entity_id
                     * @property {string|null} [owner_principal_id] FileMetadata owner_principal_id
                     * @property {rntme.contracts.storage.v1.FileState|null} [state] FileMetadata state
                     * @property {string|null} [content_type] FileMetadata content_type
                     * @property {number|Long|null} [declared_size] FileMetadata declared_size
                     * @property {number|Long|null} [actual_size] FileMetadata actual_size
                     * @property {string|null} [sha256] FileMetadata sha256
                     * @property {string|null} [object_key] FileMetadata object_key
                     * @property {google.protobuf.ITimestamp|null} [initiated_at] FileMetadata initiated_at
                     * @property {google.protobuf.ITimestamp|null} [expires_at] FileMetadata expires_at
                     * @property {google.protobuf.ITimestamp|null} [committed_at] FileMetadata committed_at
                     * @property {google.protobuf.ITimestamp|null} [deleted_at] FileMetadata deleted_at
                     */

                    /**
                     * Constructs a new FileMetadata.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a FileMetadata.
                     * @implements IFileMetadata
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IFileMetadata=} [properties] Properties to set
                     */
                    function FileMetadata(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * FileMetadata file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.file_id = "";

                    /**
                     * FileMetadata route_id.
                     * @member {string} route_id
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.route_id = "";

                    /**
                     * FileMetadata entity_id.
                     * @member {string} entity_id
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.entity_id = "";

                    /**
                     * FileMetadata owner_principal_id.
                     * @member {string} owner_principal_id
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.owner_principal_id = "";

                    /**
                     * FileMetadata state.
                     * @member {rntme.contracts.storage.v1.FileState} state
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.state = 0;

                    /**
                     * FileMetadata content_type.
                     * @member {string} content_type
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.content_type = "";

                    /**
                     * FileMetadata declared_size.
                     * @member {number|Long} declared_size
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.declared_size = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                    /**
                     * FileMetadata actual_size.
                     * @member {number|Long} actual_size
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.actual_size = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                    /**
                     * FileMetadata sha256.
                     * @member {string} sha256
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.sha256 = "";

                    /**
                     * FileMetadata object_key.
                     * @member {string} object_key
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.object_key = "";

                    /**
                     * FileMetadata initiated_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} initiated_at
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.initiated_at = null;

                    /**
                     * FileMetadata expires_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} expires_at
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.expires_at = null;

                    /**
                     * FileMetadata committed_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} committed_at
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.committed_at = null;

                    /**
                     * FileMetadata deleted_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} deleted_at
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     */
                    FileMetadata.prototype.deleted_at = null;

                    /**
                     * Creates a new FileMetadata instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileMetadata=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.FileMetadata} FileMetadata instance
                     */
                    FileMetadata.create = function create(properties) {
                        return new FileMetadata(properties);
                    };

                    /**
                     * Encodes the specified FileMetadata message. Does not implicitly {@link rntme.contracts.storage.v1.FileMetadata.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileMetadata} message FileMetadata message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileMetadata.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.file_id);
                        if (message.route_id != null && Object.hasOwnProperty.call(message, "route_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.route_id);
                        if (message.entity_id != null && Object.hasOwnProperty.call(message, "entity_id"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.entity_id);
                        if (message.owner_principal_id != null && Object.hasOwnProperty.call(message, "owner_principal_id"))
                            writer.uint32(/* id 4, wireType 2 =*/34).string(message.owner_principal_id);
                        if (message.state != null && Object.hasOwnProperty.call(message, "state"))
                            writer.uint32(/* id 5, wireType 0 =*/40).int32(message.state);
                        if (message.content_type != null && Object.hasOwnProperty.call(message, "content_type"))
                            writer.uint32(/* id 6, wireType 2 =*/50).string(message.content_type);
                        if (message.declared_size != null && Object.hasOwnProperty.call(message, "declared_size"))
                            writer.uint32(/* id 7, wireType 0 =*/56).int64(message.declared_size);
                        if (message.actual_size != null && Object.hasOwnProperty.call(message, "actual_size"))
                            writer.uint32(/* id 8, wireType 0 =*/64).int64(message.actual_size);
                        if (message.sha256 != null && Object.hasOwnProperty.call(message, "sha256"))
                            writer.uint32(/* id 9, wireType 2 =*/74).string(message.sha256);
                        if (message.object_key != null && Object.hasOwnProperty.call(message, "object_key"))
                            writer.uint32(/* id 10, wireType 2 =*/82).string(message.object_key);
                        if (message.initiated_at != null && Object.hasOwnProperty.call(message, "initiated_at"))
                            $root.google.protobuf.Timestamp.encode(message.initiated_at, writer.uint32(/* id 11, wireType 2 =*/90).fork()).ldelim();
                        if (message.expires_at != null && Object.hasOwnProperty.call(message, "expires_at"))
                            $root.google.protobuf.Timestamp.encode(message.expires_at, writer.uint32(/* id 12, wireType 2 =*/98).fork()).ldelim();
                        if (message.committed_at != null && Object.hasOwnProperty.call(message, "committed_at"))
                            $root.google.protobuf.Timestamp.encode(message.committed_at, writer.uint32(/* id 13, wireType 2 =*/106).fork()).ldelim();
                        if (message.deleted_at != null && Object.hasOwnProperty.call(message, "deleted_at"))
                            $root.google.protobuf.Timestamp.encode(message.deleted_at, writer.uint32(/* id 14, wireType 2 =*/114).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified FileMetadata message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.FileMetadata.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @static
                     * @param {rntme.contracts.storage.v1.IFileMetadata} message FileMetadata message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FileMetadata.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a FileMetadata message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.FileMetadata} FileMetadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileMetadata.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.FileMetadata();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.route_id = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.entity_id = reader.string();
                                    break;
                                }
                            case 4: {
                                    message.owner_principal_id = reader.string();
                                    break;
                                }
                            case 5: {
                                    message.state = reader.int32();
                                    break;
                                }
                            case 6: {
                                    message.content_type = reader.string();
                                    break;
                                }
                            case 7: {
                                    message.declared_size = reader.int64();
                                    break;
                                }
                            case 8: {
                                    message.actual_size = reader.int64();
                                    break;
                                }
                            case 9: {
                                    message.sha256 = reader.string();
                                    break;
                                }
                            case 10: {
                                    message.object_key = reader.string();
                                    break;
                                }
                            case 11: {
                                    message.initiated_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            case 12: {
                                    message.expires_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            case 13: {
                                    message.committed_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            case 14: {
                                    message.deleted_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a FileMetadata message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.FileMetadata} FileMetadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FileMetadata.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a FileMetadata message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    FileMetadata.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        if (message.route_id != null && message.hasOwnProperty("route_id"))
                            if (!$util.isString(message.route_id))
                                return "route_id: string expected";
                        if (message.entity_id != null && message.hasOwnProperty("entity_id"))
                            if (!$util.isString(message.entity_id))
                                return "entity_id: string expected";
                        if (message.owner_principal_id != null && message.hasOwnProperty("owner_principal_id"))
                            if (!$util.isString(message.owner_principal_id))
                                return "owner_principal_id: string expected";
                        if (message.state != null && message.hasOwnProperty("state"))
                            switch (message.state) {
                            default:
                                return "state: enum value expected";
                            case 0:
                            case 1:
                            case 2:
                            case 3:
                            case 4:
                            case 100:
                                break;
                            }
                        if (message.content_type != null && message.hasOwnProperty("content_type"))
                            if (!$util.isString(message.content_type))
                                return "content_type: string expected";
                        if (message.declared_size != null && message.hasOwnProperty("declared_size"))
                            if (!$util.isInteger(message.declared_size) && !(message.declared_size && $util.isInteger(message.declared_size.low) && $util.isInteger(message.declared_size.high)))
                                return "declared_size: integer|Long expected";
                        if (message.actual_size != null && message.hasOwnProperty("actual_size"))
                            if (!$util.isInteger(message.actual_size) && !(message.actual_size && $util.isInteger(message.actual_size.low) && $util.isInteger(message.actual_size.high)))
                                return "actual_size: integer|Long expected";
                        if (message.sha256 != null && message.hasOwnProperty("sha256"))
                            if (!$util.isString(message.sha256))
                                return "sha256: string expected";
                        if (message.object_key != null && message.hasOwnProperty("object_key"))
                            if (!$util.isString(message.object_key))
                                return "object_key: string expected";
                        if (message.initiated_at != null && message.hasOwnProperty("initiated_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.initiated_at);
                            if (error)
                                return "initiated_at." + error;
                        }
                        if (message.expires_at != null && message.hasOwnProperty("expires_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.expires_at);
                            if (error)
                                return "expires_at." + error;
                        }
                        if (message.committed_at != null && message.hasOwnProperty("committed_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.committed_at);
                            if (error)
                                return "committed_at." + error;
                        }
                        if (message.deleted_at != null && message.hasOwnProperty("deleted_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.deleted_at);
                            if (error)
                                return "deleted_at." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a FileMetadata message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.FileMetadata} FileMetadata
                     */
                    FileMetadata.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.FileMetadata)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.FileMetadata();
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        if (object.route_id != null)
                            message.route_id = String(object.route_id);
                        if (object.entity_id != null)
                            message.entity_id = String(object.entity_id);
                        if (object.owner_principal_id != null)
                            message.owner_principal_id = String(object.owner_principal_id);
                        switch (object.state) {
                        default:
                            if (typeof object.state === "number") {
                                message.state = object.state;
                                break;
                            }
                            break;
                        case "FILE_STATE_UNSPECIFIED":
                        case 0:
                            message.state = 0;
                            break;
                        case "FILE_STATE_PENDING":
                        case 1:
                            message.state = 1;
                            break;
                        case "FILE_STATE_COMMITTED":
                        case 2:
                            message.state = 2;
                            break;
                        case "FILE_STATE_ABORTED":
                        case 3:
                            message.state = 3;
                            break;
                        case "FILE_STATE_DELETED":
                        case 4:
                            message.state = 4;
                            break;
                        case "FILE_STATE_VENDOR_SPECIFIC":
                        case 100:
                            message.state = 100;
                            break;
                        }
                        if (object.content_type != null)
                            message.content_type = String(object.content_type);
                        if (object.declared_size != null)
                            if ($util.Long)
                                (message.declared_size = $util.Long.fromValue(object.declared_size)).unsigned = false;
                            else if (typeof object.declared_size === "string")
                                message.declared_size = parseInt(object.declared_size, 10);
                            else if (typeof object.declared_size === "number")
                                message.declared_size = object.declared_size;
                            else if (typeof object.declared_size === "object")
                                message.declared_size = new $util.LongBits(object.declared_size.low >>> 0, object.declared_size.high >>> 0).toNumber();
                        if (object.actual_size != null)
                            if ($util.Long)
                                (message.actual_size = $util.Long.fromValue(object.actual_size)).unsigned = false;
                            else if (typeof object.actual_size === "string")
                                message.actual_size = parseInt(object.actual_size, 10);
                            else if (typeof object.actual_size === "number")
                                message.actual_size = object.actual_size;
                            else if (typeof object.actual_size === "object")
                                message.actual_size = new $util.LongBits(object.actual_size.low >>> 0, object.actual_size.high >>> 0).toNumber();
                        if (object.sha256 != null)
                            message.sha256 = String(object.sha256);
                        if (object.object_key != null)
                            message.object_key = String(object.object_key);
                        if (object.initiated_at != null) {
                            if (typeof object.initiated_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileMetadata.initiated_at: object expected");
                            message.initiated_at = $root.google.protobuf.Timestamp.fromObject(object.initiated_at);
                        }
                        if (object.expires_at != null) {
                            if (typeof object.expires_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileMetadata.expires_at: object expected");
                            message.expires_at = $root.google.protobuf.Timestamp.fromObject(object.expires_at);
                        }
                        if (object.committed_at != null) {
                            if (typeof object.committed_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileMetadata.committed_at: object expected");
                            message.committed_at = $root.google.protobuf.Timestamp.fromObject(object.committed_at);
                        }
                        if (object.deleted_at != null) {
                            if (typeof object.deleted_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.FileMetadata.deleted_at: object expected");
                            message.deleted_at = $root.google.protobuf.Timestamp.fromObject(object.deleted_at);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a FileMetadata message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @static
                     * @param {rntme.contracts.storage.v1.FileMetadata} message FileMetadata
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    FileMetadata.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.file_id = "";
                            object.route_id = "";
                            object.entity_id = "";
                            object.owner_principal_id = "";
                            object.state = options.enums === String ? "FILE_STATE_UNSPECIFIED" : 0;
                            object.content_type = "";
                            if ($util.Long) {
                                let long = new $util.Long(0, 0, false);
                                object.declared_size = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                            } else
                                object.declared_size = options.longs === String ? "0" : 0;
                            if ($util.Long) {
                                let long = new $util.Long(0, 0, false);
                                object.actual_size = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                            } else
                                object.actual_size = options.longs === String ? "0" : 0;
                            object.sha256 = "";
                            object.object_key = "";
                            object.initiated_at = null;
                            object.expires_at = null;
                            object.committed_at = null;
                            object.deleted_at = null;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        if (message.route_id != null && message.hasOwnProperty("route_id"))
                            object.route_id = message.route_id;
                        if (message.entity_id != null && message.hasOwnProperty("entity_id"))
                            object.entity_id = message.entity_id;
                        if (message.owner_principal_id != null && message.hasOwnProperty("owner_principal_id"))
                            object.owner_principal_id = message.owner_principal_id;
                        if (message.state != null && message.hasOwnProperty("state"))
                            object.state = options.enums === String ? $root.rntme.contracts.storage.v1.FileState[message.state] === undefined ? message.state : $root.rntme.contracts.storage.v1.FileState[message.state] : message.state;
                        if (message.content_type != null && message.hasOwnProperty("content_type"))
                            object.content_type = message.content_type;
                        if (message.declared_size != null && message.hasOwnProperty("declared_size"))
                            if (typeof message.declared_size === "number")
                                object.declared_size = options.longs === String ? String(message.declared_size) : message.declared_size;
                            else
                                object.declared_size = options.longs === String ? $util.Long.prototype.toString.call(message.declared_size) : options.longs === Number ? new $util.LongBits(message.declared_size.low >>> 0, message.declared_size.high >>> 0).toNumber() : message.declared_size;
                        if (message.actual_size != null && message.hasOwnProperty("actual_size"))
                            if (typeof message.actual_size === "number")
                                object.actual_size = options.longs === String ? String(message.actual_size) : message.actual_size;
                            else
                                object.actual_size = options.longs === String ? $util.Long.prototype.toString.call(message.actual_size) : options.longs === Number ? new $util.LongBits(message.actual_size.low >>> 0, message.actual_size.high >>> 0).toNumber() : message.actual_size;
                        if (message.sha256 != null && message.hasOwnProperty("sha256"))
                            object.sha256 = message.sha256;
                        if (message.object_key != null && message.hasOwnProperty("object_key"))
                            object.object_key = message.object_key;
                        if (message.initiated_at != null && message.hasOwnProperty("initiated_at"))
                            object.initiated_at = $root.google.protobuf.Timestamp.toObject(message.initiated_at, options);
                        if (message.expires_at != null && message.hasOwnProperty("expires_at"))
                            object.expires_at = $root.google.protobuf.Timestamp.toObject(message.expires_at, options);
                        if (message.committed_at != null && message.hasOwnProperty("committed_at"))
                            object.committed_at = $root.google.protobuf.Timestamp.toObject(message.committed_at, options);
                        if (message.deleted_at != null && message.hasOwnProperty("deleted_at"))
                            object.deleted_at = $root.google.protobuf.Timestamp.toObject(message.deleted_at, options);
                        return object;
                    };

                    /**
                     * Converts this FileMetadata to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    FileMetadata.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for FileMetadata
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.FileMetadata
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    FileMetadata.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.FileMetadata";
                    };

                    return FileMetadata;
                })();

                v1.PresignedRequest = (function() {

                    /**
                     * Properties of a PresignedRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IPresignedRequest
                     * @property {string|null} [url] PresignedRequest url
                     * @property {Object.<string,string>|null} [headers] PresignedRequest headers
                     * @property {google.protobuf.ITimestamp|null} [expires_at] PresignedRequest expires_at
                     */

                    /**
                     * Constructs a new PresignedRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a PresignedRequest.
                     * @implements IPresignedRequest
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IPresignedRequest=} [properties] Properties to set
                     */
                    function PresignedRequest(properties) {
                        this.headers = {};
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * PresignedRequest url.
                     * @member {string} url
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @instance
                     */
                    PresignedRequest.prototype.url = "";

                    /**
                     * PresignedRequest headers.
                     * @member {Object.<string,string>} headers
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @instance
                     */
                    PresignedRequest.prototype.headers = $util.emptyObject;

                    /**
                     * PresignedRequest expires_at.
                     * @member {google.protobuf.ITimestamp|null|undefined} expires_at
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @instance
                     */
                    PresignedRequest.prototype.expires_at = null;

                    /**
                     * Creates a new PresignedRequest instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IPresignedRequest=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.PresignedRequest} PresignedRequest instance
                     */
                    PresignedRequest.create = function create(properties) {
                        return new PresignedRequest(properties);
                    };

                    /**
                     * Encodes the specified PresignedRequest message. Does not implicitly {@link rntme.contracts.storage.v1.PresignedRequest.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IPresignedRequest} message PresignedRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PresignedRequest.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.url != null && Object.hasOwnProperty.call(message, "url"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.url);
                        if (message.headers != null && Object.hasOwnProperty.call(message, "headers"))
                            for (let keys = Object.keys(message.headers), i = 0; i < keys.length; ++i)
                                writer.uint32(/* id 2, wireType 2 =*/18).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 2 =*/18).string(message.headers[keys[i]]).ldelim();
                        if (message.expires_at != null && Object.hasOwnProperty.call(message, "expires_at"))
                            $root.google.protobuf.Timestamp.encode(message.expires_at, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified PresignedRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.PresignedRequest.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IPresignedRequest} message PresignedRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PresignedRequest.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a PresignedRequest message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.PresignedRequest} PresignedRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PresignedRequest.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.PresignedRequest(), key, value;
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.url = reader.string();
                                    break;
                                }
                            case 2: {
                                    if (message.headers === $util.emptyObject)
                                        message.headers = {};
                                    let end2 = reader.uint32() + reader.pos;
                                    key = "";
                                    value = "";
                                    while (reader.pos < end2) {
                                        let tag2 = reader.uint32();
                                        switch (tag2 >>> 3) {
                                        case 1:
                                            key = reader.string();
                                            break;
                                        case 2:
                                            value = reader.string();
                                            break;
                                        default:
                                            reader.skipType(tag2 & 7);
                                            break;
                                        }
                                    }
                                    message.headers[key] = value;
                                    break;
                                }
                            case 3: {
                                    message.expires_at = $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a PresignedRequest message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.PresignedRequest} PresignedRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PresignedRequest.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a PresignedRequest message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    PresignedRequest.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.url != null && message.hasOwnProperty("url"))
                            if (!$util.isString(message.url))
                                return "url: string expected";
                        if (message.headers != null && message.hasOwnProperty("headers")) {
                            if (!$util.isObject(message.headers))
                                return "headers: object expected";
                            let key = Object.keys(message.headers);
                            for (let i = 0; i < key.length; ++i)
                                if (!$util.isString(message.headers[key[i]]))
                                    return "headers: string{k:string} expected";
                        }
                        if (message.expires_at != null && message.hasOwnProperty("expires_at")) {
                            let error = $root.google.protobuf.Timestamp.verify(message.expires_at);
                            if (error)
                                return "expires_at." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a PresignedRequest message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.PresignedRequest} PresignedRequest
                     */
                    PresignedRequest.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.PresignedRequest)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.PresignedRequest();
                        if (object.url != null)
                            message.url = String(object.url);
                        if (object.headers) {
                            if (typeof object.headers !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.PresignedRequest.headers: object expected");
                            message.headers = {};
                            for (let keys = Object.keys(object.headers), i = 0; i < keys.length; ++i)
                                message.headers[keys[i]] = String(object.headers[keys[i]]);
                        }
                        if (object.expires_at != null) {
                            if (typeof object.expires_at !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.PresignedRequest.expires_at: object expected");
                            message.expires_at = $root.google.protobuf.Timestamp.fromObject(object.expires_at);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a PresignedRequest message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.PresignedRequest} message PresignedRequest
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    PresignedRequest.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.objects || options.defaults)
                            object.headers = {};
                        if (options.defaults) {
                            object.url = "";
                            object.expires_at = null;
                        }
                        if (message.url != null && message.hasOwnProperty("url"))
                            object.url = message.url;
                        let keys2;
                        if (message.headers && (keys2 = Object.keys(message.headers)).length) {
                            object.headers = {};
                            for (let j = 0; j < keys2.length; ++j)
                                object.headers[keys2[j]] = message.headers[keys2[j]];
                        }
                        if (message.expires_at != null && message.hasOwnProperty("expires_at"))
                            object.expires_at = $root.google.protobuf.Timestamp.toObject(message.expires_at, options);
                        return object;
                    };

                    /**
                     * Converts this PresignedRequest to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    PresignedRequest.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for PresignedRequest
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.PresignedRequest
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    PresignedRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.PresignedRequest";
                    };

                    return PresignedRequest;
                })();

                v1.PrepareUploadRequest = (function() {

                    /**
                     * Properties of a PrepareUploadRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IPrepareUploadRequest
                     * @property {rntme.contracts.common.v1.ICommandContext|null} [context] PrepareUploadRequest context
                     * @property {string|null} [route_id] PrepareUploadRequest route_id
                     * @property {string|null} [entity_id] PrepareUploadRequest entity_id
                     * @property {string|null} [filename] PrepareUploadRequest filename
                     * @property {string|null} [content_type] PrepareUploadRequest content_type
                     * @property {number|Long|null} [declared_size] PrepareUploadRequest declared_size
                     */

                    /**
                     * Constructs a new PrepareUploadRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a PrepareUploadRequest.
                     * @implements IPrepareUploadRequest
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IPrepareUploadRequest=} [properties] Properties to set
                     */
                    function PrepareUploadRequest(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * PrepareUploadRequest context.
                     * @member {rntme.contracts.common.v1.ICommandContext|null|undefined} context
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @instance
                     */
                    PrepareUploadRequest.prototype.context = null;

                    /**
                     * PrepareUploadRequest route_id.
                     * @member {string} route_id
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @instance
                     */
                    PrepareUploadRequest.prototype.route_id = "";

                    /**
                     * PrepareUploadRequest entity_id.
                     * @member {string} entity_id
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @instance
                     */
                    PrepareUploadRequest.prototype.entity_id = "";

                    /**
                     * PrepareUploadRequest filename.
                     * @member {string} filename
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @instance
                     */
                    PrepareUploadRequest.prototype.filename = "";

                    /**
                     * PrepareUploadRequest content_type.
                     * @member {string} content_type
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @instance
                     */
                    PrepareUploadRequest.prototype.content_type = "";

                    /**
                     * PrepareUploadRequest declared_size.
                     * @member {number|Long} declared_size
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @instance
                     */
                    PrepareUploadRequest.prototype.declared_size = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                    /**
                     * Creates a new PrepareUploadRequest instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IPrepareUploadRequest=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.PrepareUploadRequest} PrepareUploadRequest instance
                     */
                    PrepareUploadRequest.create = function create(properties) {
                        return new PrepareUploadRequest(properties);
                    };

                    /**
                     * Encodes the specified PrepareUploadRequest message. Does not implicitly {@link rntme.contracts.storage.v1.PrepareUploadRequest.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IPrepareUploadRequest} message PrepareUploadRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrepareUploadRequest.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                            $root.rntme.contracts.common.v1.CommandContext.encode(message.context, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.route_id != null && Object.hasOwnProperty.call(message, "route_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.route_id);
                        if (message.entity_id != null && Object.hasOwnProperty.call(message, "entity_id"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.entity_id);
                        if (message.filename != null && Object.hasOwnProperty.call(message, "filename"))
                            writer.uint32(/* id 4, wireType 2 =*/34).string(message.filename);
                        if (message.content_type != null && Object.hasOwnProperty.call(message, "content_type"))
                            writer.uint32(/* id 5, wireType 2 =*/42).string(message.content_type);
                        if (message.declared_size != null && Object.hasOwnProperty.call(message, "declared_size"))
                            writer.uint32(/* id 6, wireType 0 =*/48).int64(message.declared_size);
                        return writer;
                    };

                    /**
                     * Encodes the specified PrepareUploadRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.PrepareUploadRequest.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IPrepareUploadRequest} message PrepareUploadRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrepareUploadRequest.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a PrepareUploadRequest message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.PrepareUploadRequest} PrepareUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrepareUploadRequest.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.PrepareUploadRequest();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.context = $root.rntme.contracts.common.v1.CommandContext.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.route_id = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.entity_id = reader.string();
                                    break;
                                }
                            case 4: {
                                    message.filename = reader.string();
                                    break;
                                }
                            case 5: {
                                    message.content_type = reader.string();
                                    break;
                                }
                            case 6: {
                                    message.declared_size = reader.int64();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a PrepareUploadRequest message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.PrepareUploadRequest} PrepareUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrepareUploadRequest.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a PrepareUploadRequest message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    PrepareUploadRequest.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.context != null && message.hasOwnProperty("context")) {
                            let error = $root.rntme.contracts.common.v1.CommandContext.verify(message.context);
                            if (error)
                                return "context." + error;
                        }
                        if (message.route_id != null && message.hasOwnProperty("route_id"))
                            if (!$util.isString(message.route_id))
                                return "route_id: string expected";
                        if (message.entity_id != null && message.hasOwnProperty("entity_id"))
                            if (!$util.isString(message.entity_id))
                                return "entity_id: string expected";
                        if (message.filename != null && message.hasOwnProperty("filename"))
                            if (!$util.isString(message.filename))
                                return "filename: string expected";
                        if (message.content_type != null && message.hasOwnProperty("content_type"))
                            if (!$util.isString(message.content_type))
                                return "content_type: string expected";
                        if (message.declared_size != null && message.hasOwnProperty("declared_size"))
                            if (!$util.isInteger(message.declared_size) && !(message.declared_size && $util.isInteger(message.declared_size.low) && $util.isInteger(message.declared_size.high)))
                                return "declared_size: integer|Long expected";
                        return null;
                    };

                    /**
                     * Creates a PrepareUploadRequest message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.PrepareUploadRequest} PrepareUploadRequest
                     */
                    PrepareUploadRequest.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.PrepareUploadRequest)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.PrepareUploadRequest();
                        if (object.context != null) {
                            if (typeof object.context !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.PrepareUploadRequest.context: object expected");
                            message.context = $root.rntme.contracts.common.v1.CommandContext.fromObject(object.context);
                        }
                        if (object.route_id != null)
                            message.route_id = String(object.route_id);
                        if (object.entity_id != null)
                            message.entity_id = String(object.entity_id);
                        if (object.filename != null)
                            message.filename = String(object.filename);
                        if (object.content_type != null)
                            message.content_type = String(object.content_type);
                        if (object.declared_size != null)
                            if ($util.Long)
                                (message.declared_size = $util.Long.fromValue(object.declared_size)).unsigned = false;
                            else if (typeof object.declared_size === "string")
                                message.declared_size = parseInt(object.declared_size, 10);
                            else if (typeof object.declared_size === "number")
                                message.declared_size = object.declared_size;
                            else if (typeof object.declared_size === "object")
                                message.declared_size = new $util.LongBits(object.declared_size.low >>> 0, object.declared_size.high >>> 0).toNumber();
                        return message;
                    };

                    /**
                     * Creates a plain object from a PrepareUploadRequest message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.PrepareUploadRequest} message PrepareUploadRequest
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    PrepareUploadRequest.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.context = null;
                            object.route_id = "";
                            object.entity_id = "";
                            object.filename = "";
                            object.content_type = "";
                            if ($util.Long) {
                                let long = new $util.Long(0, 0, false);
                                object.declared_size = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                            } else
                                object.declared_size = options.longs === String ? "0" : 0;
                        }
                        if (message.context != null && message.hasOwnProperty("context"))
                            object.context = $root.rntme.contracts.common.v1.CommandContext.toObject(message.context, options);
                        if (message.route_id != null && message.hasOwnProperty("route_id"))
                            object.route_id = message.route_id;
                        if (message.entity_id != null && message.hasOwnProperty("entity_id"))
                            object.entity_id = message.entity_id;
                        if (message.filename != null && message.hasOwnProperty("filename"))
                            object.filename = message.filename;
                        if (message.content_type != null && message.hasOwnProperty("content_type"))
                            object.content_type = message.content_type;
                        if (message.declared_size != null && message.hasOwnProperty("declared_size"))
                            if (typeof message.declared_size === "number")
                                object.declared_size = options.longs === String ? String(message.declared_size) : message.declared_size;
                            else
                                object.declared_size = options.longs === String ? $util.Long.prototype.toString.call(message.declared_size) : options.longs === Number ? new $util.LongBits(message.declared_size.low >>> 0, message.declared_size.high >>> 0).toNumber() : message.declared_size;
                        return object;
                    };

                    /**
                     * Converts this PrepareUploadRequest to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    PrepareUploadRequest.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for PrepareUploadRequest
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.PrepareUploadRequest
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    PrepareUploadRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.PrepareUploadRequest";
                    };

                    return PrepareUploadRequest;
                })();

                v1.PrepareUploadResponse = (function() {

                    /**
                     * Properties of a PrepareUploadResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IPrepareUploadResponse
                     * @property {string|null} [file_id] PrepareUploadResponse file_id
                     * @property {string|null} [object_key] PrepareUploadResponse object_key
                     * @property {rntme.contracts.storage.v1.IPresignedRequest|null} [presigned] PrepareUploadResponse presigned
                     */

                    /**
                     * Constructs a new PrepareUploadResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a PrepareUploadResponse.
                     * @implements IPrepareUploadResponse
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IPrepareUploadResponse=} [properties] Properties to set
                     */
                    function PrepareUploadResponse(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * PrepareUploadResponse file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @instance
                     */
                    PrepareUploadResponse.prototype.file_id = "";

                    /**
                     * PrepareUploadResponse object_key.
                     * @member {string} object_key
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @instance
                     */
                    PrepareUploadResponse.prototype.object_key = "";

                    /**
                     * PrepareUploadResponse presigned.
                     * @member {rntme.contracts.storage.v1.IPresignedRequest|null|undefined} presigned
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @instance
                     */
                    PrepareUploadResponse.prototype.presigned = null;

                    /**
                     * Creates a new PrepareUploadResponse instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IPrepareUploadResponse=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.PrepareUploadResponse} PrepareUploadResponse instance
                     */
                    PrepareUploadResponse.create = function create(properties) {
                        return new PrepareUploadResponse(properties);
                    };

                    /**
                     * Encodes the specified PrepareUploadResponse message. Does not implicitly {@link rntme.contracts.storage.v1.PrepareUploadResponse.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IPrepareUploadResponse} message PrepareUploadResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrepareUploadResponse.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.file_id);
                        if (message.object_key != null && Object.hasOwnProperty.call(message, "object_key"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.object_key);
                        if (message.presigned != null && Object.hasOwnProperty.call(message, "presigned"))
                            $root.rntme.contracts.storage.v1.PresignedRequest.encode(message.presigned, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified PrepareUploadResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.PrepareUploadResponse.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IPrepareUploadResponse} message PrepareUploadResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrepareUploadResponse.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a PrepareUploadResponse message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.PrepareUploadResponse} PrepareUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrepareUploadResponse.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.PrepareUploadResponse();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.object_key = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.presigned = $root.rntme.contracts.storage.v1.PresignedRequest.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a PrepareUploadResponse message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.PrepareUploadResponse} PrepareUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrepareUploadResponse.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a PrepareUploadResponse message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    PrepareUploadResponse.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        if (message.object_key != null && message.hasOwnProperty("object_key"))
                            if (!$util.isString(message.object_key))
                                return "object_key: string expected";
                        if (message.presigned != null && message.hasOwnProperty("presigned")) {
                            let error = $root.rntme.contracts.storage.v1.PresignedRequest.verify(message.presigned);
                            if (error)
                                return "presigned." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a PrepareUploadResponse message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.PrepareUploadResponse} PrepareUploadResponse
                     */
                    PrepareUploadResponse.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.PrepareUploadResponse)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.PrepareUploadResponse();
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        if (object.object_key != null)
                            message.object_key = String(object.object_key);
                        if (object.presigned != null) {
                            if (typeof object.presigned !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.PrepareUploadResponse.presigned: object expected");
                            message.presigned = $root.rntme.contracts.storage.v1.PresignedRequest.fromObject(object.presigned);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a PrepareUploadResponse message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.PrepareUploadResponse} message PrepareUploadResponse
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    PrepareUploadResponse.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.file_id = "";
                            object.object_key = "";
                            object.presigned = null;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        if (message.object_key != null && message.hasOwnProperty("object_key"))
                            object.object_key = message.object_key;
                        if (message.presigned != null && message.hasOwnProperty("presigned"))
                            object.presigned = $root.rntme.contracts.storage.v1.PresignedRequest.toObject(message.presigned, options);
                        return object;
                    };

                    /**
                     * Converts this PrepareUploadResponse to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    PrepareUploadResponse.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for PrepareUploadResponse
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.PrepareUploadResponse
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    PrepareUploadResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.PrepareUploadResponse";
                    };

                    return PrepareUploadResponse;
                })();

                v1.CommitUploadRequest = (function() {

                    /**
                     * Properties of a CommitUploadRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @interface ICommitUploadRequest
                     * @property {rntme.contracts.common.v1.ICommandContext|null} [context] CommitUploadRequest context
                     * @property {string|null} [file_id] CommitUploadRequest file_id
                     */

                    /**
                     * Constructs a new CommitUploadRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a CommitUploadRequest.
                     * @implements ICommitUploadRequest
                     * @constructor
                     * @param {rntme.contracts.storage.v1.ICommitUploadRequest=} [properties] Properties to set
                     */
                    function CommitUploadRequest(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * CommitUploadRequest context.
                     * @member {rntme.contracts.common.v1.ICommandContext|null|undefined} context
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @instance
                     */
                    CommitUploadRequest.prototype.context = null;

                    /**
                     * CommitUploadRequest file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @instance
                     */
                    CommitUploadRequest.prototype.file_id = "";

                    /**
                     * Creates a new CommitUploadRequest instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.ICommitUploadRequest=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.CommitUploadRequest} CommitUploadRequest instance
                     */
                    CommitUploadRequest.create = function create(properties) {
                        return new CommitUploadRequest(properties);
                    };

                    /**
                     * Encodes the specified CommitUploadRequest message. Does not implicitly {@link rntme.contracts.storage.v1.CommitUploadRequest.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.ICommitUploadRequest} message CommitUploadRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CommitUploadRequest.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                            $root.rntme.contracts.common.v1.CommandContext.encode(message.context, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.file_id);
                        return writer;
                    };

                    /**
                     * Encodes the specified CommitUploadRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.CommitUploadRequest.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.ICommitUploadRequest} message CommitUploadRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CommitUploadRequest.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a CommitUploadRequest message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.CommitUploadRequest} CommitUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CommitUploadRequest.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.CommitUploadRequest();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.context = $root.rntme.contracts.common.v1.CommandContext.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a CommitUploadRequest message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.CommitUploadRequest} CommitUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CommitUploadRequest.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a CommitUploadRequest message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    CommitUploadRequest.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.context != null && message.hasOwnProperty("context")) {
                            let error = $root.rntme.contracts.common.v1.CommandContext.verify(message.context);
                            if (error)
                                return "context." + error;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        return null;
                    };

                    /**
                     * Creates a CommitUploadRequest message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.CommitUploadRequest} CommitUploadRequest
                     */
                    CommitUploadRequest.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.CommitUploadRequest)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.CommitUploadRequest();
                        if (object.context != null) {
                            if (typeof object.context !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.CommitUploadRequest.context: object expected");
                            message.context = $root.rntme.contracts.common.v1.CommandContext.fromObject(object.context);
                        }
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        return message;
                    };

                    /**
                     * Creates a plain object from a CommitUploadRequest message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.CommitUploadRequest} message CommitUploadRequest
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    CommitUploadRequest.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.context = null;
                            object.file_id = "";
                        }
                        if (message.context != null && message.hasOwnProperty("context"))
                            object.context = $root.rntme.contracts.common.v1.CommandContext.toObject(message.context, options);
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        return object;
                    };

                    /**
                     * Converts this CommitUploadRequest to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    CommitUploadRequest.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for CommitUploadRequest
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.CommitUploadRequest
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    CommitUploadRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.CommitUploadRequest";
                    };

                    return CommitUploadRequest;
                })();

                v1.CommitUploadResponse = (function() {

                    /**
                     * Properties of a CommitUploadResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @interface ICommitUploadResponse
                     * @property {rntme.contracts.storage.v1.IFileMetadata|null} [file] CommitUploadResponse file
                     */

                    /**
                     * Constructs a new CommitUploadResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a CommitUploadResponse.
                     * @implements ICommitUploadResponse
                     * @constructor
                     * @param {rntme.contracts.storage.v1.ICommitUploadResponse=} [properties] Properties to set
                     */
                    function CommitUploadResponse(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * CommitUploadResponse file.
                     * @member {rntme.contracts.storage.v1.IFileMetadata|null|undefined} file
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @instance
                     */
                    CommitUploadResponse.prototype.file = null;

                    /**
                     * Creates a new CommitUploadResponse instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.ICommitUploadResponse=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.CommitUploadResponse} CommitUploadResponse instance
                     */
                    CommitUploadResponse.create = function create(properties) {
                        return new CommitUploadResponse(properties);
                    };

                    /**
                     * Encodes the specified CommitUploadResponse message. Does not implicitly {@link rntme.contracts.storage.v1.CommitUploadResponse.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.ICommitUploadResponse} message CommitUploadResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CommitUploadResponse.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file != null && Object.hasOwnProperty.call(message, "file"))
                            $root.rntme.contracts.storage.v1.FileMetadata.encode(message.file, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified CommitUploadResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.CommitUploadResponse.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.ICommitUploadResponse} message CommitUploadResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CommitUploadResponse.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a CommitUploadResponse message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.CommitUploadResponse} CommitUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CommitUploadResponse.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.CommitUploadResponse();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file = $root.rntme.contracts.storage.v1.FileMetadata.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a CommitUploadResponse message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.CommitUploadResponse} CommitUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CommitUploadResponse.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a CommitUploadResponse message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    CommitUploadResponse.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file != null && message.hasOwnProperty("file")) {
                            let error = $root.rntme.contracts.storage.v1.FileMetadata.verify(message.file);
                            if (error)
                                return "file." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a CommitUploadResponse message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.CommitUploadResponse} CommitUploadResponse
                     */
                    CommitUploadResponse.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.CommitUploadResponse)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.CommitUploadResponse();
                        if (object.file != null) {
                            if (typeof object.file !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.CommitUploadResponse.file: object expected");
                            message.file = $root.rntme.contracts.storage.v1.FileMetadata.fromObject(object.file);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a CommitUploadResponse message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.CommitUploadResponse} message CommitUploadResponse
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    CommitUploadResponse.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.file = null;
                        if (message.file != null && message.hasOwnProperty("file"))
                            object.file = $root.rntme.contracts.storage.v1.FileMetadata.toObject(message.file, options);
                        return object;
                    };

                    /**
                     * Converts this CommitUploadResponse to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    CommitUploadResponse.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for CommitUploadResponse
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.CommitUploadResponse
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    CommitUploadResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.CommitUploadResponse";
                    };

                    return CommitUploadResponse;
                })();

                v1.AbortUploadRequest = (function() {

                    /**
                     * Properties of an AbortUploadRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IAbortUploadRequest
                     * @property {rntme.contracts.common.v1.ICommandContext|null} [context] AbortUploadRequest context
                     * @property {string|null} [file_id] AbortUploadRequest file_id
                     * @property {string|null} [reason] AbortUploadRequest reason
                     */

                    /**
                     * Constructs a new AbortUploadRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents an AbortUploadRequest.
                     * @implements IAbortUploadRequest
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IAbortUploadRequest=} [properties] Properties to set
                     */
                    function AbortUploadRequest(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * AbortUploadRequest context.
                     * @member {rntme.contracts.common.v1.ICommandContext|null|undefined} context
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @instance
                     */
                    AbortUploadRequest.prototype.context = null;

                    /**
                     * AbortUploadRequest file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @instance
                     */
                    AbortUploadRequest.prototype.file_id = "";

                    /**
                     * AbortUploadRequest reason.
                     * @member {string} reason
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @instance
                     */
                    AbortUploadRequest.prototype.reason = "";

                    /**
                     * Creates a new AbortUploadRequest instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IAbortUploadRequest=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.AbortUploadRequest} AbortUploadRequest instance
                     */
                    AbortUploadRequest.create = function create(properties) {
                        return new AbortUploadRequest(properties);
                    };

                    /**
                     * Encodes the specified AbortUploadRequest message. Does not implicitly {@link rntme.contracts.storage.v1.AbortUploadRequest.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IAbortUploadRequest} message AbortUploadRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AbortUploadRequest.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                            $root.rntme.contracts.common.v1.CommandContext.encode(message.context, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.file_id);
                        if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.reason);
                        return writer;
                    };

                    /**
                     * Encodes the specified AbortUploadRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.AbortUploadRequest.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IAbortUploadRequest} message AbortUploadRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AbortUploadRequest.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an AbortUploadRequest message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.AbortUploadRequest} AbortUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AbortUploadRequest.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.AbortUploadRequest();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.context = $root.rntme.contracts.common.v1.CommandContext.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.reason = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an AbortUploadRequest message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.AbortUploadRequest} AbortUploadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AbortUploadRequest.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an AbortUploadRequest message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    AbortUploadRequest.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.context != null && message.hasOwnProperty("context")) {
                            let error = $root.rntme.contracts.common.v1.CommandContext.verify(message.context);
                            if (error)
                                return "context." + error;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        if (message.reason != null && message.hasOwnProperty("reason"))
                            if (!$util.isString(message.reason))
                                return "reason: string expected";
                        return null;
                    };

                    /**
                     * Creates an AbortUploadRequest message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.AbortUploadRequest} AbortUploadRequest
                     */
                    AbortUploadRequest.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.AbortUploadRequest)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.AbortUploadRequest();
                        if (object.context != null) {
                            if (typeof object.context !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.AbortUploadRequest.context: object expected");
                            message.context = $root.rntme.contracts.common.v1.CommandContext.fromObject(object.context);
                        }
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        if (object.reason != null)
                            message.reason = String(object.reason);
                        return message;
                    };

                    /**
                     * Creates a plain object from an AbortUploadRequest message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.AbortUploadRequest} message AbortUploadRequest
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    AbortUploadRequest.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.context = null;
                            object.file_id = "";
                            object.reason = "";
                        }
                        if (message.context != null && message.hasOwnProperty("context"))
                            object.context = $root.rntme.contracts.common.v1.CommandContext.toObject(message.context, options);
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        if (message.reason != null && message.hasOwnProperty("reason"))
                            object.reason = message.reason;
                        return object;
                    };

                    /**
                     * Converts this AbortUploadRequest to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    AbortUploadRequest.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for AbortUploadRequest
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.AbortUploadRequest
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    AbortUploadRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.AbortUploadRequest";
                    };

                    return AbortUploadRequest;
                })();

                v1.AbortUploadResponse = (function() {

                    /**
                     * Properties of an AbortUploadResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IAbortUploadResponse
                     * @property {rntme.contracts.storage.v1.IFileMetadata|null} [file] AbortUploadResponse file
                     */

                    /**
                     * Constructs a new AbortUploadResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents an AbortUploadResponse.
                     * @implements IAbortUploadResponse
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IAbortUploadResponse=} [properties] Properties to set
                     */
                    function AbortUploadResponse(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * AbortUploadResponse file.
                     * @member {rntme.contracts.storage.v1.IFileMetadata|null|undefined} file
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @instance
                     */
                    AbortUploadResponse.prototype.file = null;

                    /**
                     * Creates a new AbortUploadResponse instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IAbortUploadResponse=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.AbortUploadResponse} AbortUploadResponse instance
                     */
                    AbortUploadResponse.create = function create(properties) {
                        return new AbortUploadResponse(properties);
                    };

                    /**
                     * Encodes the specified AbortUploadResponse message. Does not implicitly {@link rntme.contracts.storage.v1.AbortUploadResponse.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IAbortUploadResponse} message AbortUploadResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AbortUploadResponse.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file != null && Object.hasOwnProperty.call(message, "file"))
                            $root.rntme.contracts.storage.v1.FileMetadata.encode(message.file, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified AbortUploadResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.AbortUploadResponse.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IAbortUploadResponse} message AbortUploadResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AbortUploadResponse.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an AbortUploadResponse message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.AbortUploadResponse} AbortUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AbortUploadResponse.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.AbortUploadResponse();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file = $root.rntme.contracts.storage.v1.FileMetadata.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an AbortUploadResponse message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.AbortUploadResponse} AbortUploadResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AbortUploadResponse.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an AbortUploadResponse message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    AbortUploadResponse.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file != null && message.hasOwnProperty("file")) {
                            let error = $root.rntme.contracts.storage.v1.FileMetadata.verify(message.file);
                            if (error)
                                return "file." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates an AbortUploadResponse message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.AbortUploadResponse} AbortUploadResponse
                     */
                    AbortUploadResponse.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.AbortUploadResponse)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.AbortUploadResponse();
                        if (object.file != null) {
                            if (typeof object.file !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.AbortUploadResponse.file: object expected");
                            message.file = $root.rntme.contracts.storage.v1.FileMetadata.fromObject(object.file);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an AbortUploadResponse message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.AbortUploadResponse} message AbortUploadResponse
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    AbortUploadResponse.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.file = null;
                        if (message.file != null && message.hasOwnProperty("file"))
                            object.file = $root.rntme.contracts.storage.v1.FileMetadata.toObject(message.file, options);
                        return object;
                    };

                    /**
                     * Converts this AbortUploadResponse to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    AbortUploadResponse.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for AbortUploadResponse
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.AbortUploadResponse
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    AbortUploadResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.AbortUploadResponse";
                    };

                    return AbortUploadResponse;
                })();

                v1.GetFileRequest = (function() {

                    /**
                     * Properties of a GetFileRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IGetFileRequest
                     * @property {rntme.contracts.common.v1.ICommandContext|null} [context] GetFileRequest context
                     * @property {string|null} [file_id] GetFileRequest file_id
                     */

                    /**
                     * Constructs a new GetFileRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a GetFileRequest.
                     * @implements IGetFileRequest
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IGetFileRequest=} [properties] Properties to set
                     */
                    function GetFileRequest(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * GetFileRequest context.
                     * @member {rntme.contracts.common.v1.ICommandContext|null|undefined} context
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @instance
                     */
                    GetFileRequest.prototype.context = null;

                    /**
                     * GetFileRequest file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @instance
                     */
                    GetFileRequest.prototype.file_id = "";

                    /**
                     * Creates a new GetFileRequest instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetFileRequest=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.GetFileRequest} GetFileRequest instance
                     */
                    GetFileRequest.create = function create(properties) {
                        return new GetFileRequest(properties);
                    };

                    /**
                     * Encodes the specified GetFileRequest message. Does not implicitly {@link rntme.contracts.storage.v1.GetFileRequest.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetFileRequest} message GetFileRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    GetFileRequest.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                            $root.rntme.contracts.common.v1.CommandContext.encode(message.context, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.file_id);
                        return writer;
                    };

                    /**
                     * Encodes the specified GetFileRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.GetFileRequest.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetFileRequest} message GetFileRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    GetFileRequest.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a GetFileRequest message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.GetFileRequest} GetFileRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    GetFileRequest.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.GetFileRequest();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.context = $root.rntme.contracts.common.v1.CommandContext.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a GetFileRequest message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.GetFileRequest} GetFileRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    GetFileRequest.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a GetFileRequest message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    GetFileRequest.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.context != null && message.hasOwnProperty("context")) {
                            let error = $root.rntme.contracts.common.v1.CommandContext.verify(message.context);
                            if (error)
                                return "context." + error;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        return null;
                    };

                    /**
                     * Creates a GetFileRequest message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.GetFileRequest} GetFileRequest
                     */
                    GetFileRequest.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.GetFileRequest)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.GetFileRequest();
                        if (object.context != null) {
                            if (typeof object.context !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.GetFileRequest.context: object expected");
                            message.context = $root.rntme.contracts.common.v1.CommandContext.fromObject(object.context);
                        }
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        return message;
                    };

                    /**
                     * Creates a plain object from a GetFileRequest message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.GetFileRequest} message GetFileRequest
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    GetFileRequest.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.context = null;
                            object.file_id = "";
                        }
                        if (message.context != null && message.hasOwnProperty("context"))
                            object.context = $root.rntme.contracts.common.v1.CommandContext.toObject(message.context, options);
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        return object;
                    };

                    /**
                     * Converts this GetFileRequest to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    GetFileRequest.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for GetFileRequest
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.GetFileRequest
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    GetFileRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.GetFileRequest";
                    };

                    return GetFileRequest;
                })();

                v1.GetFileResponse = (function() {

                    /**
                     * Properties of a GetFileResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IGetFileResponse
                     * @property {rntme.contracts.storage.v1.IFileMetadata|null} [file] GetFileResponse file
                     */

                    /**
                     * Constructs a new GetFileResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a GetFileResponse.
                     * @implements IGetFileResponse
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IGetFileResponse=} [properties] Properties to set
                     */
                    function GetFileResponse(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * GetFileResponse file.
                     * @member {rntme.contracts.storage.v1.IFileMetadata|null|undefined} file
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @instance
                     */
                    GetFileResponse.prototype.file = null;

                    /**
                     * Creates a new GetFileResponse instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetFileResponse=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.GetFileResponse} GetFileResponse instance
                     */
                    GetFileResponse.create = function create(properties) {
                        return new GetFileResponse(properties);
                    };

                    /**
                     * Encodes the specified GetFileResponse message. Does not implicitly {@link rntme.contracts.storage.v1.GetFileResponse.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetFileResponse} message GetFileResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    GetFileResponse.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file != null && Object.hasOwnProperty.call(message, "file"))
                            $root.rntme.contracts.storage.v1.FileMetadata.encode(message.file, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified GetFileResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.GetFileResponse.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetFileResponse} message GetFileResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    GetFileResponse.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a GetFileResponse message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.GetFileResponse} GetFileResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    GetFileResponse.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.GetFileResponse();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file = $root.rntme.contracts.storage.v1.FileMetadata.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a GetFileResponse message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.GetFileResponse} GetFileResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    GetFileResponse.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a GetFileResponse message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    GetFileResponse.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file != null && message.hasOwnProperty("file")) {
                            let error = $root.rntme.contracts.storage.v1.FileMetadata.verify(message.file);
                            if (error)
                                return "file." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a GetFileResponse message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.GetFileResponse} GetFileResponse
                     */
                    GetFileResponse.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.GetFileResponse)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.GetFileResponse();
                        if (object.file != null) {
                            if (typeof object.file !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.GetFileResponse.file: object expected");
                            message.file = $root.rntme.contracts.storage.v1.FileMetadata.fromObject(object.file);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a GetFileResponse message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.GetFileResponse} message GetFileResponse
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    GetFileResponse.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.file = null;
                        if (message.file != null && message.hasOwnProperty("file"))
                            object.file = $root.rntme.contracts.storage.v1.FileMetadata.toObject(message.file, options);
                        return object;
                    };

                    /**
                     * Converts this GetFileResponse to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    GetFileResponse.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for GetFileResponse
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.GetFileResponse
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    GetFileResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.GetFileResponse";
                    };

                    return GetFileResponse;
                })();

                v1.ListFilesRequest = (function() {

                    /**
                     * Properties of a ListFilesRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IListFilesRequest
                     * @property {rntme.contracts.common.v1.ICommandContext|null} [context] ListFilesRequest context
                     * @property {string|null} [route_id] ListFilesRequest route_id
                     * @property {string|null} [entity_id] ListFilesRequest entity_id
                     * @property {number|null} [limit] ListFilesRequest limit
                     * @property {string|null} [page_token] ListFilesRequest page_token
                     */

                    /**
                     * Constructs a new ListFilesRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a ListFilesRequest.
                     * @implements IListFilesRequest
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IListFilesRequest=} [properties] Properties to set
                     */
                    function ListFilesRequest(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ListFilesRequest context.
                     * @member {rntme.contracts.common.v1.ICommandContext|null|undefined} context
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @instance
                     */
                    ListFilesRequest.prototype.context = null;

                    /**
                     * ListFilesRequest route_id.
                     * @member {string} route_id
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @instance
                     */
                    ListFilesRequest.prototype.route_id = "";

                    /**
                     * ListFilesRequest entity_id.
                     * @member {string} entity_id
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @instance
                     */
                    ListFilesRequest.prototype.entity_id = "";

                    /**
                     * ListFilesRequest limit.
                     * @member {number} limit
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @instance
                     */
                    ListFilesRequest.prototype.limit = 0;

                    /**
                     * ListFilesRequest page_token.
                     * @member {string} page_token
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @instance
                     */
                    ListFilesRequest.prototype.page_token = "";

                    /**
                     * Creates a new ListFilesRequest instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IListFilesRequest=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.ListFilesRequest} ListFilesRequest instance
                     */
                    ListFilesRequest.create = function create(properties) {
                        return new ListFilesRequest(properties);
                    };

                    /**
                     * Encodes the specified ListFilesRequest message. Does not implicitly {@link rntme.contracts.storage.v1.ListFilesRequest.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IListFilesRequest} message ListFilesRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ListFilesRequest.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                            $root.rntme.contracts.common.v1.CommandContext.encode(message.context, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.route_id != null && Object.hasOwnProperty.call(message, "route_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.route_id);
                        if (message.entity_id != null && Object.hasOwnProperty.call(message, "entity_id"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.entity_id);
                        if (message.limit != null && Object.hasOwnProperty.call(message, "limit"))
                            writer.uint32(/* id 4, wireType 0 =*/32).int32(message.limit);
                        if (message.page_token != null && Object.hasOwnProperty.call(message, "page_token"))
                            writer.uint32(/* id 5, wireType 2 =*/42).string(message.page_token);
                        return writer;
                    };

                    /**
                     * Encodes the specified ListFilesRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.ListFilesRequest.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IListFilesRequest} message ListFilesRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ListFilesRequest.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ListFilesRequest message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.ListFilesRequest} ListFilesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ListFilesRequest.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.ListFilesRequest();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.context = $root.rntme.contracts.common.v1.CommandContext.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.route_id = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.entity_id = reader.string();
                                    break;
                                }
                            case 4: {
                                    message.limit = reader.int32();
                                    break;
                                }
                            case 5: {
                                    message.page_token = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ListFilesRequest message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.ListFilesRequest} ListFilesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ListFilesRequest.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ListFilesRequest message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ListFilesRequest.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.context != null && message.hasOwnProperty("context")) {
                            let error = $root.rntme.contracts.common.v1.CommandContext.verify(message.context);
                            if (error)
                                return "context." + error;
                        }
                        if (message.route_id != null && message.hasOwnProperty("route_id"))
                            if (!$util.isString(message.route_id))
                                return "route_id: string expected";
                        if (message.entity_id != null && message.hasOwnProperty("entity_id"))
                            if (!$util.isString(message.entity_id))
                                return "entity_id: string expected";
                        if (message.limit != null && message.hasOwnProperty("limit"))
                            if (!$util.isInteger(message.limit))
                                return "limit: integer expected";
                        if (message.page_token != null && message.hasOwnProperty("page_token"))
                            if (!$util.isString(message.page_token))
                                return "page_token: string expected";
                        return null;
                    };

                    /**
                     * Creates a ListFilesRequest message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.ListFilesRequest} ListFilesRequest
                     */
                    ListFilesRequest.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.ListFilesRequest)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.ListFilesRequest();
                        if (object.context != null) {
                            if (typeof object.context !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.ListFilesRequest.context: object expected");
                            message.context = $root.rntme.contracts.common.v1.CommandContext.fromObject(object.context);
                        }
                        if (object.route_id != null)
                            message.route_id = String(object.route_id);
                        if (object.entity_id != null)
                            message.entity_id = String(object.entity_id);
                        if (object.limit != null)
                            message.limit = object.limit | 0;
                        if (object.page_token != null)
                            message.page_token = String(object.page_token);
                        return message;
                    };

                    /**
                     * Creates a plain object from a ListFilesRequest message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.ListFilesRequest} message ListFilesRequest
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ListFilesRequest.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.context = null;
                            object.route_id = "";
                            object.entity_id = "";
                            object.limit = 0;
                            object.page_token = "";
                        }
                        if (message.context != null && message.hasOwnProperty("context"))
                            object.context = $root.rntme.contracts.common.v1.CommandContext.toObject(message.context, options);
                        if (message.route_id != null && message.hasOwnProperty("route_id"))
                            object.route_id = message.route_id;
                        if (message.entity_id != null && message.hasOwnProperty("entity_id"))
                            object.entity_id = message.entity_id;
                        if (message.limit != null && message.hasOwnProperty("limit"))
                            object.limit = message.limit;
                        if (message.page_token != null && message.hasOwnProperty("page_token"))
                            object.page_token = message.page_token;
                        return object;
                    };

                    /**
                     * Converts this ListFilesRequest to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ListFilesRequest.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ListFilesRequest
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.ListFilesRequest
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ListFilesRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.ListFilesRequest";
                    };

                    return ListFilesRequest;
                })();

                v1.ListFilesResponse = (function() {

                    /**
                     * Properties of a ListFilesResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IListFilesResponse
                     * @property {Array.<rntme.contracts.storage.v1.IFileMetadata>|null} [files] ListFilesResponse files
                     * @property {string|null} [next_page_token] ListFilesResponse next_page_token
                     */

                    /**
                     * Constructs a new ListFilesResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a ListFilesResponse.
                     * @implements IListFilesResponse
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IListFilesResponse=} [properties] Properties to set
                     */
                    function ListFilesResponse(properties) {
                        this.files = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ListFilesResponse files.
                     * @member {Array.<rntme.contracts.storage.v1.IFileMetadata>} files
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @instance
                     */
                    ListFilesResponse.prototype.files = $util.emptyArray;

                    /**
                     * ListFilesResponse next_page_token.
                     * @member {string} next_page_token
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @instance
                     */
                    ListFilesResponse.prototype.next_page_token = "";

                    /**
                     * Creates a new ListFilesResponse instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IListFilesResponse=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.ListFilesResponse} ListFilesResponse instance
                     */
                    ListFilesResponse.create = function create(properties) {
                        return new ListFilesResponse(properties);
                    };

                    /**
                     * Encodes the specified ListFilesResponse message. Does not implicitly {@link rntme.contracts.storage.v1.ListFilesResponse.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IListFilesResponse} message ListFilesResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ListFilesResponse.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.files != null && message.files.length)
                            for (let i = 0; i < message.files.length; ++i)
                                $root.rntme.contracts.storage.v1.FileMetadata.encode(message.files[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.next_page_token != null && Object.hasOwnProperty.call(message, "next_page_token"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.next_page_token);
                        return writer;
                    };

                    /**
                     * Encodes the specified ListFilesResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.ListFilesResponse.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IListFilesResponse} message ListFilesResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ListFilesResponse.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ListFilesResponse message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.ListFilesResponse} ListFilesResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ListFilesResponse.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.ListFilesResponse();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.files && message.files.length))
                                        message.files = [];
                                    message.files.push($root.rntme.contracts.storage.v1.FileMetadata.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 2: {
                                    message.next_page_token = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ListFilesResponse message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.ListFilesResponse} ListFilesResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ListFilesResponse.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ListFilesResponse message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ListFilesResponse.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.files != null && message.hasOwnProperty("files")) {
                            if (!Array.isArray(message.files))
                                return "files: array expected";
                            for (let i = 0; i < message.files.length; ++i) {
                                let error = $root.rntme.contracts.storage.v1.FileMetadata.verify(message.files[i]);
                                if (error)
                                    return "files." + error;
                            }
                        }
                        if (message.next_page_token != null && message.hasOwnProperty("next_page_token"))
                            if (!$util.isString(message.next_page_token))
                                return "next_page_token: string expected";
                        return null;
                    };

                    /**
                     * Creates a ListFilesResponse message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.ListFilesResponse} ListFilesResponse
                     */
                    ListFilesResponse.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.ListFilesResponse)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.ListFilesResponse();
                        if (object.files) {
                            if (!Array.isArray(object.files))
                                throw TypeError(".rntme.contracts.storage.v1.ListFilesResponse.files: array expected");
                            message.files = [];
                            for (let i = 0; i < object.files.length; ++i) {
                                if (typeof object.files[i] !== "object")
                                    throw TypeError(".rntme.contracts.storage.v1.ListFilesResponse.files: object expected");
                                message.files[i] = $root.rntme.contracts.storage.v1.FileMetadata.fromObject(object.files[i]);
                            }
                        }
                        if (object.next_page_token != null)
                            message.next_page_token = String(object.next_page_token);
                        return message;
                    };

                    /**
                     * Creates a plain object from a ListFilesResponse message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.ListFilesResponse} message ListFilesResponse
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ListFilesResponse.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.files = [];
                        if (options.defaults)
                            object.next_page_token = "";
                        if (message.files && message.files.length) {
                            object.files = [];
                            for (let j = 0; j < message.files.length; ++j)
                                object.files[j] = $root.rntme.contracts.storage.v1.FileMetadata.toObject(message.files[j], options);
                        }
                        if (message.next_page_token != null && message.hasOwnProperty("next_page_token"))
                            object.next_page_token = message.next_page_token;
                        return object;
                    };

                    /**
                     * Converts this ListFilesResponse to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ListFilesResponse.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ListFilesResponse
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.ListFilesResponse
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ListFilesResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.ListFilesResponse";
                    };

                    return ListFilesResponse;
                })();

                v1.GetDownloadUrlRequest = (function() {

                    /**
                     * Properties of a GetDownloadUrlRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IGetDownloadUrlRequest
                     * @property {rntme.contracts.common.v1.ICommandContext|null} [context] GetDownloadUrlRequest context
                     * @property {string|null} [file_id] GetDownloadUrlRequest file_id
                     * @property {number|null} [ttl_sec] GetDownloadUrlRequest ttl_sec
                     */

                    /**
                     * Constructs a new GetDownloadUrlRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a GetDownloadUrlRequest.
                     * @implements IGetDownloadUrlRequest
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlRequest=} [properties] Properties to set
                     */
                    function GetDownloadUrlRequest(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * GetDownloadUrlRequest context.
                     * @member {rntme.contracts.common.v1.ICommandContext|null|undefined} context
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @instance
                     */
                    GetDownloadUrlRequest.prototype.context = null;

                    /**
                     * GetDownloadUrlRequest file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @instance
                     */
                    GetDownloadUrlRequest.prototype.file_id = "";

                    /**
                     * GetDownloadUrlRequest ttl_sec.
                     * @member {number} ttl_sec
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @instance
                     */
                    GetDownloadUrlRequest.prototype.ttl_sec = 0;

                    /**
                     * Creates a new GetDownloadUrlRequest instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlRequest=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.GetDownloadUrlRequest} GetDownloadUrlRequest instance
                     */
                    GetDownloadUrlRequest.create = function create(properties) {
                        return new GetDownloadUrlRequest(properties);
                    };

                    /**
                     * Encodes the specified GetDownloadUrlRequest message. Does not implicitly {@link rntme.contracts.storage.v1.GetDownloadUrlRequest.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlRequest} message GetDownloadUrlRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    GetDownloadUrlRequest.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                            $root.rntme.contracts.common.v1.CommandContext.encode(message.context, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.file_id);
                        if (message.ttl_sec != null && Object.hasOwnProperty.call(message, "ttl_sec"))
                            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.ttl_sec);
                        return writer;
                    };

                    /**
                     * Encodes the specified GetDownloadUrlRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.GetDownloadUrlRequest.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlRequest} message GetDownloadUrlRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    GetDownloadUrlRequest.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a GetDownloadUrlRequest message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.GetDownloadUrlRequest} GetDownloadUrlRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    GetDownloadUrlRequest.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.GetDownloadUrlRequest();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.context = $root.rntme.contracts.common.v1.CommandContext.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.ttl_sec = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a GetDownloadUrlRequest message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.GetDownloadUrlRequest} GetDownloadUrlRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    GetDownloadUrlRequest.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a GetDownloadUrlRequest message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    GetDownloadUrlRequest.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.context != null && message.hasOwnProperty("context")) {
                            let error = $root.rntme.contracts.common.v1.CommandContext.verify(message.context);
                            if (error)
                                return "context." + error;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        if (message.ttl_sec != null && message.hasOwnProperty("ttl_sec"))
                            if (!$util.isInteger(message.ttl_sec))
                                return "ttl_sec: integer expected";
                        return null;
                    };

                    /**
                     * Creates a GetDownloadUrlRequest message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.GetDownloadUrlRequest} GetDownloadUrlRequest
                     */
                    GetDownloadUrlRequest.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.GetDownloadUrlRequest)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.GetDownloadUrlRequest();
                        if (object.context != null) {
                            if (typeof object.context !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.GetDownloadUrlRequest.context: object expected");
                            message.context = $root.rntme.contracts.common.v1.CommandContext.fromObject(object.context);
                        }
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        if (object.ttl_sec != null)
                            message.ttl_sec = object.ttl_sec | 0;
                        return message;
                    };

                    /**
                     * Creates a plain object from a GetDownloadUrlRequest message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.GetDownloadUrlRequest} message GetDownloadUrlRequest
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    GetDownloadUrlRequest.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.context = null;
                            object.file_id = "";
                            object.ttl_sec = 0;
                        }
                        if (message.context != null && message.hasOwnProperty("context"))
                            object.context = $root.rntme.contracts.common.v1.CommandContext.toObject(message.context, options);
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        if (message.ttl_sec != null && message.hasOwnProperty("ttl_sec"))
                            object.ttl_sec = message.ttl_sec;
                        return object;
                    };

                    /**
                     * Converts this GetDownloadUrlRequest to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    GetDownloadUrlRequest.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for GetDownloadUrlRequest
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlRequest
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    GetDownloadUrlRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.GetDownloadUrlRequest";
                    };

                    return GetDownloadUrlRequest;
                })();

                v1.GetDownloadUrlResponse = (function() {

                    /**
                     * Properties of a GetDownloadUrlResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IGetDownloadUrlResponse
                     * @property {rntme.contracts.storage.v1.IPresignedRequest|null} [presigned] GetDownloadUrlResponse presigned
                     */

                    /**
                     * Constructs a new GetDownloadUrlResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a GetDownloadUrlResponse.
                     * @implements IGetDownloadUrlResponse
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlResponse=} [properties] Properties to set
                     */
                    function GetDownloadUrlResponse(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * GetDownloadUrlResponse presigned.
                     * @member {rntme.contracts.storage.v1.IPresignedRequest|null|undefined} presigned
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @instance
                     */
                    GetDownloadUrlResponse.prototype.presigned = null;

                    /**
                     * Creates a new GetDownloadUrlResponse instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlResponse=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.GetDownloadUrlResponse} GetDownloadUrlResponse instance
                     */
                    GetDownloadUrlResponse.create = function create(properties) {
                        return new GetDownloadUrlResponse(properties);
                    };

                    /**
                     * Encodes the specified GetDownloadUrlResponse message. Does not implicitly {@link rntme.contracts.storage.v1.GetDownloadUrlResponse.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlResponse} message GetDownloadUrlResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    GetDownloadUrlResponse.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.presigned != null && Object.hasOwnProperty.call(message, "presigned"))
                            $root.rntme.contracts.storage.v1.PresignedRequest.encode(message.presigned, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified GetDownloadUrlResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.GetDownloadUrlResponse.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlResponse} message GetDownloadUrlResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    GetDownloadUrlResponse.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a GetDownloadUrlResponse message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.GetDownloadUrlResponse} GetDownloadUrlResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    GetDownloadUrlResponse.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.GetDownloadUrlResponse();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.presigned = $root.rntme.contracts.storage.v1.PresignedRequest.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a GetDownloadUrlResponse message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.GetDownloadUrlResponse} GetDownloadUrlResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    GetDownloadUrlResponse.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a GetDownloadUrlResponse message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    GetDownloadUrlResponse.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.presigned != null && message.hasOwnProperty("presigned")) {
                            let error = $root.rntme.contracts.storage.v1.PresignedRequest.verify(message.presigned);
                            if (error)
                                return "presigned." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a GetDownloadUrlResponse message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.GetDownloadUrlResponse} GetDownloadUrlResponse
                     */
                    GetDownloadUrlResponse.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.GetDownloadUrlResponse)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.GetDownloadUrlResponse();
                        if (object.presigned != null) {
                            if (typeof object.presigned !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.GetDownloadUrlResponse.presigned: object expected");
                            message.presigned = $root.rntme.contracts.storage.v1.PresignedRequest.fromObject(object.presigned);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a GetDownloadUrlResponse message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.GetDownloadUrlResponse} message GetDownloadUrlResponse
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    GetDownloadUrlResponse.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.presigned = null;
                        if (message.presigned != null && message.hasOwnProperty("presigned"))
                            object.presigned = $root.rntme.contracts.storage.v1.PresignedRequest.toObject(message.presigned, options);
                        return object;
                    };

                    /**
                     * Converts this GetDownloadUrlResponse to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    GetDownloadUrlResponse.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for GetDownloadUrlResponse
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.GetDownloadUrlResponse
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    GetDownloadUrlResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.GetDownloadUrlResponse";
                    };

                    return GetDownloadUrlResponse;
                })();

                v1.DeleteFileRequest = (function() {

                    /**
                     * Properties of a DeleteFileRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IDeleteFileRequest
                     * @property {rntme.contracts.common.v1.ICommandContext|null} [context] DeleteFileRequest context
                     * @property {string|null} [file_id] DeleteFileRequest file_id
                     */

                    /**
                     * Constructs a new DeleteFileRequest.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a DeleteFileRequest.
                     * @implements IDeleteFileRequest
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IDeleteFileRequest=} [properties] Properties to set
                     */
                    function DeleteFileRequest(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * DeleteFileRequest context.
                     * @member {rntme.contracts.common.v1.ICommandContext|null|undefined} context
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @instance
                     */
                    DeleteFileRequest.prototype.context = null;

                    /**
                     * DeleteFileRequest file_id.
                     * @member {string} file_id
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @instance
                     */
                    DeleteFileRequest.prototype.file_id = "";

                    /**
                     * Creates a new DeleteFileRequest instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IDeleteFileRequest=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.DeleteFileRequest} DeleteFileRequest instance
                     */
                    DeleteFileRequest.create = function create(properties) {
                        return new DeleteFileRequest(properties);
                    };

                    /**
                     * Encodes the specified DeleteFileRequest message. Does not implicitly {@link rntme.contracts.storage.v1.DeleteFileRequest.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IDeleteFileRequest} message DeleteFileRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    DeleteFileRequest.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                            $root.rntme.contracts.common.v1.CommandContext.encode(message.context, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.file_id != null && Object.hasOwnProperty.call(message, "file_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.file_id);
                        return writer;
                    };

                    /**
                     * Encodes the specified DeleteFileRequest message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.DeleteFileRequest.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.IDeleteFileRequest} message DeleteFileRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    DeleteFileRequest.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a DeleteFileRequest message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.DeleteFileRequest} DeleteFileRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    DeleteFileRequest.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.DeleteFileRequest();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.context = $root.rntme.contracts.common.v1.CommandContext.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.file_id = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a DeleteFileRequest message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.DeleteFileRequest} DeleteFileRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    DeleteFileRequest.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a DeleteFileRequest message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    DeleteFileRequest.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.context != null && message.hasOwnProperty("context")) {
                            let error = $root.rntme.contracts.common.v1.CommandContext.verify(message.context);
                            if (error)
                                return "context." + error;
                        }
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            if (!$util.isString(message.file_id))
                                return "file_id: string expected";
                        return null;
                    };

                    /**
                     * Creates a DeleteFileRequest message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.DeleteFileRequest} DeleteFileRequest
                     */
                    DeleteFileRequest.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.DeleteFileRequest)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.DeleteFileRequest();
                        if (object.context != null) {
                            if (typeof object.context !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.DeleteFileRequest.context: object expected");
                            message.context = $root.rntme.contracts.common.v1.CommandContext.fromObject(object.context);
                        }
                        if (object.file_id != null)
                            message.file_id = String(object.file_id);
                        return message;
                    };

                    /**
                     * Creates a plain object from a DeleteFileRequest message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @static
                     * @param {rntme.contracts.storage.v1.DeleteFileRequest} message DeleteFileRequest
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    DeleteFileRequest.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.context = null;
                            object.file_id = "";
                        }
                        if (message.context != null && message.hasOwnProperty("context"))
                            object.context = $root.rntme.contracts.common.v1.CommandContext.toObject(message.context, options);
                        if (message.file_id != null && message.hasOwnProperty("file_id"))
                            object.file_id = message.file_id;
                        return object;
                    };

                    /**
                     * Converts this DeleteFileRequest to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    DeleteFileRequest.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for DeleteFileRequest
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.DeleteFileRequest
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    DeleteFileRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.DeleteFileRequest";
                    };

                    return DeleteFileRequest;
                })();

                v1.DeleteFileResponse = (function() {

                    /**
                     * Properties of a DeleteFileResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @interface IDeleteFileResponse
                     * @property {rntme.contracts.storage.v1.IFileMetadata|null} [file] DeleteFileResponse file
                     */

                    /**
                     * Constructs a new DeleteFileResponse.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a DeleteFileResponse.
                     * @implements IDeleteFileResponse
                     * @constructor
                     * @param {rntme.contracts.storage.v1.IDeleteFileResponse=} [properties] Properties to set
                     */
                    function DeleteFileResponse(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * DeleteFileResponse file.
                     * @member {rntme.contracts.storage.v1.IFileMetadata|null|undefined} file
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @instance
                     */
                    DeleteFileResponse.prototype.file = null;

                    /**
                     * Creates a new DeleteFileResponse instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IDeleteFileResponse=} [properties] Properties to set
                     * @returns {rntme.contracts.storage.v1.DeleteFileResponse} DeleteFileResponse instance
                     */
                    DeleteFileResponse.create = function create(properties) {
                        return new DeleteFileResponse(properties);
                    };

                    /**
                     * Encodes the specified DeleteFileResponse message. Does not implicitly {@link rntme.contracts.storage.v1.DeleteFileResponse.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IDeleteFileResponse} message DeleteFileResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    DeleteFileResponse.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.file != null && Object.hasOwnProperty.call(message, "file"))
                            $root.rntme.contracts.storage.v1.FileMetadata.encode(message.file, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified DeleteFileResponse message, length delimited. Does not implicitly {@link rntme.contracts.storage.v1.DeleteFileResponse.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.IDeleteFileResponse} message DeleteFileResponse message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    DeleteFileResponse.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a DeleteFileResponse message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.storage.v1.DeleteFileResponse} DeleteFileResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    DeleteFileResponse.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.storage.v1.DeleteFileResponse();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.file = $root.rntme.contracts.storage.v1.FileMetadata.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a DeleteFileResponse message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.storage.v1.DeleteFileResponse} DeleteFileResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    DeleteFileResponse.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a DeleteFileResponse message.
                     * @function verify
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    DeleteFileResponse.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.file != null && message.hasOwnProperty("file")) {
                            let error = $root.rntme.contracts.storage.v1.FileMetadata.verify(message.file);
                            if (error)
                                return "file." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a DeleteFileResponse message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.storage.v1.DeleteFileResponse} DeleteFileResponse
                     */
                    DeleteFileResponse.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.storage.v1.DeleteFileResponse)
                            return object;
                        let message = new $root.rntme.contracts.storage.v1.DeleteFileResponse();
                        if (object.file != null) {
                            if (typeof object.file !== "object")
                                throw TypeError(".rntme.contracts.storage.v1.DeleteFileResponse.file: object expected");
                            message.file = $root.rntme.contracts.storage.v1.FileMetadata.fromObject(object.file);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a DeleteFileResponse message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @static
                     * @param {rntme.contracts.storage.v1.DeleteFileResponse} message DeleteFileResponse
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    DeleteFileResponse.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.file = null;
                        if (message.file != null && message.hasOwnProperty("file"))
                            object.file = $root.rntme.contracts.storage.v1.FileMetadata.toObject(message.file, options);
                        return object;
                    };

                    /**
                     * Converts this DeleteFileResponse to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    DeleteFileResponse.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for DeleteFileResponse
                     * @function getTypeUrl
                     * @memberof rntme.contracts.storage.v1.DeleteFileResponse
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    DeleteFileResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.storage.v1.DeleteFileResponse";
                    };

                    return DeleteFileResponse;
                })();

                v1.StorageModule = (function() {

                    /**
                     * Constructs a new StorageModule service.
                     * @memberof rntme.contracts.storage.v1
                     * @classdesc Represents a StorageModule
                     * @extends $protobuf.rpc.Service
                     * @constructor
                     * @param {$protobuf.RPCImpl} rpcImpl RPC implementation
                     * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
                     * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
                     */
                    function StorageModule(rpcImpl, requestDelimited, responseDelimited) {
                        $protobuf.rpc.Service.call(this, rpcImpl, requestDelimited, responseDelimited);
                    }

                    (StorageModule.prototype = Object.create($protobuf.rpc.Service.prototype)).constructor = StorageModule;

                    /**
                     * Creates new StorageModule service using the specified rpc implementation.
                     * @function create
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @static
                     * @param {$protobuf.RPCImpl} rpcImpl RPC implementation
                     * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
                     * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
                     * @returns {StorageModule} RPC service. Useful where requests and/or responses are streamed.
                     */
                    StorageModule.create = function create(rpcImpl, requestDelimited, responseDelimited) {
                        return new this(rpcImpl, requestDelimited, responseDelimited);
                    };

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#prepareUpload}.
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @typedef PrepareUploadCallback
                     * @type {function}
                     * @param {Error|null} error Error, if any
                     * @param {rntme.contracts.storage.v1.PrepareUploadResponse} [response] PrepareUploadResponse
                     */

                    /**
                     * Calls PrepareUpload.
                     * @function prepareUpload
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IPrepareUploadRequest} request PrepareUploadRequest message or plain object
                     * @param {rntme.contracts.storage.v1.StorageModule.PrepareUploadCallback} callback Node-style callback called with the error, if any, and PrepareUploadResponse
                     * @returns {undefined}
                     * @variation 1
                     */
                    Object.defineProperty(StorageModule.prototype.prepareUpload = function prepareUpload(request, callback) {
                        return this.rpcCall(prepareUpload, $root.rntme.contracts.storage.v1.PrepareUploadRequest, $root.rntme.contracts.storage.v1.PrepareUploadResponse, request, callback);
                    }, "name", { value: "PrepareUpload" });

                    /**
                     * Calls PrepareUpload.
                     * @function prepareUpload
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IPrepareUploadRequest} request PrepareUploadRequest message or plain object
                     * @returns {Promise<rntme.contracts.storage.v1.PrepareUploadResponse>} Promise
                     * @variation 2
                     */

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#commitUpload}.
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @typedef CommitUploadCallback
                     * @type {function}
                     * @param {Error|null} error Error, if any
                     * @param {rntme.contracts.storage.v1.CommitUploadResponse} [response] CommitUploadResponse
                     */

                    /**
                     * Calls CommitUpload.
                     * @function commitUpload
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.ICommitUploadRequest} request CommitUploadRequest message or plain object
                     * @param {rntme.contracts.storage.v1.StorageModule.CommitUploadCallback} callback Node-style callback called with the error, if any, and CommitUploadResponse
                     * @returns {undefined}
                     * @variation 1
                     */
                    Object.defineProperty(StorageModule.prototype.commitUpload = function commitUpload(request, callback) {
                        return this.rpcCall(commitUpload, $root.rntme.contracts.storage.v1.CommitUploadRequest, $root.rntme.contracts.storage.v1.CommitUploadResponse, request, callback);
                    }, "name", { value: "CommitUpload" });

                    /**
                     * Calls CommitUpload.
                     * @function commitUpload
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.ICommitUploadRequest} request CommitUploadRequest message or plain object
                     * @returns {Promise<rntme.contracts.storage.v1.CommitUploadResponse>} Promise
                     * @variation 2
                     */

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#abortUpload}.
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @typedef AbortUploadCallback
                     * @type {function}
                     * @param {Error|null} error Error, if any
                     * @param {rntme.contracts.storage.v1.AbortUploadResponse} [response] AbortUploadResponse
                     */

                    /**
                     * Calls AbortUpload.
                     * @function abortUpload
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IAbortUploadRequest} request AbortUploadRequest message or plain object
                     * @param {rntme.contracts.storage.v1.StorageModule.AbortUploadCallback} callback Node-style callback called with the error, if any, and AbortUploadResponse
                     * @returns {undefined}
                     * @variation 1
                     */
                    Object.defineProperty(StorageModule.prototype.abortUpload = function abortUpload(request, callback) {
                        return this.rpcCall(abortUpload, $root.rntme.contracts.storage.v1.AbortUploadRequest, $root.rntme.contracts.storage.v1.AbortUploadResponse, request, callback);
                    }, "name", { value: "AbortUpload" });

                    /**
                     * Calls AbortUpload.
                     * @function abortUpload
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IAbortUploadRequest} request AbortUploadRequest message or plain object
                     * @returns {Promise<rntme.contracts.storage.v1.AbortUploadResponse>} Promise
                     * @variation 2
                     */

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#getFile}.
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @typedef GetFileCallback
                     * @type {function}
                     * @param {Error|null} error Error, if any
                     * @param {rntme.contracts.storage.v1.GetFileResponse} [response] GetFileResponse
                     */

                    /**
                     * Calls GetFile.
                     * @function getFile
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IGetFileRequest} request GetFileRequest message or plain object
                     * @param {rntme.contracts.storage.v1.StorageModule.GetFileCallback} callback Node-style callback called with the error, if any, and GetFileResponse
                     * @returns {undefined}
                     * @variation 1
                     */
                    Object.defineProperty(StorageModule.prototype.getFile = function getFile(request, callback) {
                        return this.rpcCall(getFile, $root.rntme.contracts.storage.v1.GetFileRequest, $root.rntme.contracts.storage.v1.GetFileResponse, request, callback);
                    }, "name", { value: "GetFile" });

                    /**
                     * Calls GetFile.
                     * @function getFile
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IGetFileRequest} request GetFileRequest message or plain object
                     * @returns {Promise<rntme.contracts.storage.v1.GetFileResponse>} Promise
                     * @variation 2
                     */

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#listFiles}.
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @typedef ListFilesCallback
                     * @type {function}
                     * @param {Error|null} error Error, if any
                     * @param {rntme.contracts.storage.v1.ListFilesResponse} [response] ListFilesResponse
                     */

                    /**
                     * Calls ListFiles.
                     * @function listFiles
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IListFilesRequest} request ListFilesRequest message or plain object
                     * @param {rntme.contracts.storage.v1.StorageModule.ListFilesCallback} callback Node-style callback called with the error, if any, and ListFilesResponse
                     * @returns {undefined}
                     * @variation 1
                     */
                    Object.defineProperty(StorageModule.prototype.listFiles = function listFiles(request, callback) {
                        return this.rpcCall(listFiles, $root.rntme.contracts.storage.v1.ListFilesRequest, $root.rntme.contracts.storage.v1.ListFilesResponse, request, callback);
                    }, "name", { value: "ListFiles" });

                    /**
                     * Calls ListFiles.
                     * @function listFiles
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IListFilesRequest} request ListFilesRequest message or plain object
                     * @returns {Promise<rntme.contracts.storage.v1.ListFilesResponse>} Promise
                     * @variation 2
                     */

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#getDownloadUrl}.
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @typedef GetDownloadUrlCallback
                     * @type {function}
                     * @param {Error|null} error Error, if any
                     * @param {rntme.contracts.storage.v1.GetDownloadUrlResponse} [response] GetDownloadUrlResponse
                     */

                    /**
                     * Calls GetDownloadUrl.
                     * @function getDownloadUrl
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlRequest} request GetDownloadUrlRequest message or plain object
                     * @param {rntme.contracts.storage.v1.StorageModule.GetDownloadUrlCallback} callback Node-style callback called with the error, if any, and GetDownloadUrlResponse
                     * @returns {undefined}
                     * @variation 1
                     */
                    Object.defineProperty(StorageModule.prototype.getDownloadUrl = function getDownloadUrl(request, callback) {
                        return this.rpcCall(getDownloadUrl, $root.rntme.contracts.storage.v1.GetDownloadUrlRequest, $root.rntme.contracts.storage.v1.GetDownloadUrlResponse, request, callback);
                    }, "name", { value: "GetDownloadUrl" });

                    /**
                     * Calls GetDownloadUrl.
                     * @function getDownloadUrl
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IGetDownloadUrlRequest} request GetDownloadUrlRequest message or plain object
                     * @returns {Promise<rntme.contracts.storage.v1.GetDownloadUrlResponse>} Promise
                     * @variation 2
                     */

                    /**
                     * Callback as used by {@link rntme.contracts.storage.v1.StorageModule#deleteFile}.
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @typedef DeleteFileCallback
                     * @type {function}
                     * @param {Error|null} error Error, if any
                     * @param {rntme.contracts.storage.v1.DeleteFileResponse} [response] DeleteFileResponse
                     */

                    /**
                     * Calls DeleteFile.
                     * @function deleteFile
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IDeleteFileRequest} request DeleteFileRequest message or plain object
                     * @param {rntme.contracts.storage.v1.StorageModule.DeleteFileCallback} callback Node-style callback called with the error, if any, and DeleteFileResponse
                     * @returns {undefined}
                     * @variation 1
                     */
                    Object.defineProperty(StorageModule.prototype.deleteFile = function deleteFile(request, callback) {
                        return this.rpcCall(deleteFile, $root.rntme.contracts.storage.v1.DeleteFileRequest, $root.rntme.contracts.storage.v1.DeleteFileResponse, request, callback);
                    }, "name", { value: "DeleteFile" });

                    /**
                     * Calls DeleteFile.
                     * @function deleteFile
                     * @memberof rntme.contracts.storage.v1.StorageModule
                     * @instance
                     * @param {rntme.contracts.storage.v1.IDeleteFileRequest} request DeleteFileRequest message or plain object
                     * @returns {Promise<rntme.contracts.storage.v1.DeleteFileResponse>} Promise
                     * @variation 2
                     */

                    return StorageModule;
                })();

                return v1;
            })();

            return storage;
        })();

        contracts.common = (function() {

            /**
             * Namespace common.
             * @memberof rntme.contracts
             * @namespace
             */
            const common = {};

            common.v1 = (function() {

                /**
                 * Namespace v1.
                 * @memberof rntme.contracts.common
                 * @namespace
                 */
                const v1 = {};

                v1.CanonicalRef = (function() {

                    /**
                     * Properties of a CanonicalRef.
                     * @memberof rntme.contracts.common.v1
                     * @interface ICanonicalRef
                     * @property {string|null} [canonical_id] CanonicalRef canonical_id
                     * @property {string|null} [vendor_id] CanonicalRef vendor_id
                     * @property {string|null} [module_name] CanonicalRef module_name
                     * @property {string|null} [module_version] CanonicalRef module_version
                     * @property {string|null} [contract_version] CanonicalRef contract_version
                     */

                    /**
                     * Constructs a new CanonicalRef.
                     * @memberof rntme.contracts.common.v1
                     * @classdesc Represents a CanonicalRef.
                     * @implements ICanonicalRef
                     * @constructor
                     * @param {rntme.contracts.common.v1.ICanonicalRef=} [properties] Properties to set
                     */
                    function CanonicalRef(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * CanonicalRef canonical_id.
                     * @member {string} canonical_id
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @instance
                     */
                    CanonicalRef.prototype.canonical_id = "";

                    /**
                     * CanonicalRef vendor_id.
                     * @member {string} vendor_id
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @instance
                     */
                    CanonicalRef.prototype.vendor_id = "";

                    /**
                     * CanonicalRef module_name.
                     * @member {string} module_name
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @instance
                     */
                    CanonicalRef.prototype.module_name = "";

                    /**
                     * CanonicalRef module_version.
                     * @member {string} module_version
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @instance
                     */
                    CanonicalRef.prototype.module_version = "";

                    /**
                     * CanonicalRef contract_version.
                     * @member {string} contract_version
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @instance
                     */
                    CanonicalRef.prototype.contract_version = "";

                    /**
                     * Creates a new CanonicalRef instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @static
                     * @param {rntme.contracts.common.v1.ICanonicalRef=} [properties] Properties to set
                     * @returns {rntme.contracts.common.v1.CanonicalRef} CanonicalRef instance
                     */
                    CanonicalRef.create = function create(properties) {
                        return new CanonicalRef(properties);
                    };

                    /**
                     * Encodes the specified CanonicalRef message. Does not implicitly {@link rntme.contracts.common.v1.CanonicalRef.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @static
                     * @param {rntme.contracts.common.v1.ICanonicalRef} message CanonicalRef message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CanonicalRef.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.canonical_id != null && Object.hasOwnProperty.call(message, "canonical_id"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.canonical_id);
                        if (message.vendor_id != null && Object.hasOwnProperty.call(message, "vendor_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.vendor_id);
                        if (message.module_name != null && Object.hasOwnProperty.call(message, "module_name"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.module_name);
                        if (message.module_version != null && Object.hasOwnProperty.call(message, "module_version"))
                            writer.uint32(/* id 4, wireType 2 =*/34).string(message.module_version);
                        if (message.contract_version != null && Object.hasOwnProperty.call(message, "contract_version"))
                            writer.uint32(/* id 5, wireType 2 =*/42).string(message.contract_version);
                        return writer;
                    };

                    /**
                     * Encodes the specified CanonicalRef message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.CanonicalRef.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @static
                     * @param {rntme.contracts.common.v1.ICanonicalRef} message CanonicalRef message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CanonicalRef.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a CanonicalRef message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.common.v1.CanonicalRef} CanonicalRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CanonicalRef.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.common.v1.CanonicalRef();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.canonical_id = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.vendor_id = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.module_name = reader.string();
                                    break;
                                }
                            case 4: {
                                    message.module_version = reader.string();
                                    break;
                                }
                            case 5: {
                                    message.contract_version = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a CanonicalRef message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.common.v1.CanonicalRef} CanonicalRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CanonicalRef.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a CanonicalRef message.
                     * @function verify
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    CanonicalRef.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.canonical_id != null && message.hasOwnProperty("canonical_id"))
                            if (!$util.isString(message.canonical_id))
                                return "canonical_id: string expected";
                        if (message.vendor_id != null && message.hasOwnProperty("vendor_id"))
                            if (!$util.isString(message.vendor_id))
                                return "vendor_id: string expected";
                        if (message.module_name != null && message.hasOwnProperty("module_name"))
                            if (!$util.isString(message.module_name))
                                return "module_name: string expected";
                        if (message.module_version != null && message.hasOwnProperty("module_version"))
                            if (!$util.isString(message.module_version))
                                return "module_version: string expected";
                        if (message.contract_version != null && message.hasOwnProperty("contract_version"))
                            if (!$util.isString(message.contract_version))
                                return "contract_version: string expected";
                        return null;
                    };

                    /**
                     * Creates a CanonicalRef message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.common.v1.CanonicalRef} CanonicalRef
                     */
                    CanonicalRef.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.common.v1.CanonicalRef)
                            return object;
                        let message = new $root.rntme.contracts.common.v1.CanonicalRef();
                        if (object.canonical_id != null)
                            message.canonical_id = String(object.canonical_id);
                        if (object.vendor_id != null)
                            message.vendor_id = String(object.vendor_id);
                        if (object.module_name != null)
                            message.module_name = String(object.module_name);
                        if (object.module_version != null)
                            message.module_version = String(object.module_version);
                        if (object.contract_version != null)
                            message.contract_version = String(object.contract_version);
                        return message;
                    };

                    /**
                     * Creates a plain object from a CanonicalRef message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @static
                     * @param {rntme.contracts.common.v1.CanonicalRef} message CanonicalRef
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    CanonicalRef.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.canonical_id = "";
                            object.vendor_id = "";
                            object.module_name = "";
                            object.module_version = "";
                            object.contract_version = "";
                        }
                        if (message.canonical_id != null && message.hasOwnProperty("canonical_id"))
                            object.canonical_id = message.canonical_id;
                        if (message.vendor_id != null && message.hasOwnProperty("vendor_id"))
                            object.vendor_id = message.vendor_id;
                        if (message.module_name != null && message.hasOwnProperty("module_name"))
                            object.module_name = message.module_name;
                        if (message.module_version != null && message.hasOwnProperty("module_version"))
                            object.module_version = message.module_version;
                        if (message.contract_version != null && message.hasOwnProperty("contract_version"))
                            object.contract_version = message.contract_version;
                        return object;
                    };

                    /**
                     * Converts this CanonicalRef to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    CanonicalRef.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for CanonicalRef
                     * @function getTypeUrl
                     * @memberof rntme.contracts.common.v1.CanonicalRef
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    CanonicalRef.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.common.v1.CanonicalRef";
                    };

                    return CanonicalRef;
                })();

                v1.CommandContext = (function() {

                    /**
                     * Properties of a CommandContext.
                     * @memberof rntme.contracts.common.v1
                     * @interface ICommandContext
                     * @property {string|null} [idempotency_key] CommandContext idempotency_key
                     * @property {string|null} [correlation_id] CommandContext correlation_id
                     * @property {string|null} [actor_user_id] CommandContext actor_user_id
                     * @property {string|null} [actor_type] CommandContext actor_type
                     * @property {string|null} [tenant_id] CommandContext tenant_id
                     */

                    /**
                     * Constructs a new CommandContext.
                     * @memberof rntme.contracts.common.v1
                     * @classdesc Represents a CommandContext.
                     * @implements ICommandContext
                     * @constructor
                     * @param {rntme.contracts.common.v1.ICommandContext=} [properties] Properties to set
                     */
                    function CommandContext(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * CommandContext idempotency_key.
                     * @member {string} idempotency_key
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @instance
                     */
                    CommandContext.prototype.idempotency_key = "";

                    /**
                     * CommandContext correlation_id.
                     * @member {string} correlation_id
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @instance
                     */
                    CommandContext.prototype.correlation_id = "";

                    /**
                     * CommandContext actor_user_id.
                     * @member {string} actor_user_id
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @instance
                     */
                    CommandContext.prototype.actor_user_id = "";

                    /**
                     * CommandContext actor_type.
                     * @member {string} actor_type
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @instance
                     */
                    CommandContext.prototype.actor_type = "";

                    /**
                     * CommandContext tenant_id.
                     * @member {string} tenant_id
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @instance
                     */
                    CommandContext.prototype.tenant_id = "";

                    /**
                     * Creates a new CommandContext instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @static
                     * @param {rntme.contracts.common.v1.ICommandContext=} [properties] Properties to set
                     * @returns {rntme.contracts.common.v1.CommandContext} CommandContext instance
                     */
                    CommandContext.create = function create(properties) {
                        return new CommandContext(properties);
                    };

                    /**
                     * Encodes the specified CommandContext message. Does not implicitly {@link rntme.contracts.common.v1.CommandContext.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @static
                     * @param {rntme.contracts.common.v1.ICommandContext} message CommandContext message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CommandContext.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.idempotency_key != null && Object.hasOwnProperty.call(message, "idempotency_key"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.idempotency_key);
                        if (message.correlation_id != null && Object.hasOwnProperty.call(message, "correlation_id"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.correlation_id);
                        if (message.actor_user_id != null && Object.hasOwnProperty.call(message, "actor_user_id"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.actor_user_id);
                        if (message.actor_type != null && Object.hasOwnProperty.call(message, "actor_type"))
                            writer.uint32(/* id 4, wireType 2 =*/34).string(message.actor_type);
                        if (message.tenant_id != null && Object.hasOwnProperty.call(message, "tenant_id"))
                            writer.uint32(/* id 5, wireType 2 =*/42).string(message.tenant_id);
                        return writer;
                    };

                    /**
                     * Encodes the specified CommandContext message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.CommandContext.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @static
                     * @param {rntme.contracts.common.v1.ICommandContext} message CommandContext message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CommandContext.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a CommandContext message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.common.v1.CommandContext} CommandContext
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CommandContext.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.common.v1.CommandContext();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.idempotency_key = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.correlation_id = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.actor_user_id = reader.string();
                                    break;
                                }
                            case 4: {
                                    message.actor_type = reader.string();
                                    break;
                                }
                            case 5: {
                                    message.tenant_id = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a CommandContext message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.common.v1.CommandContext} CommandContext
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CommandContext.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a CommandContext message.
                     * @function verify
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    CommandContext.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.idempotency_key != null && message.hasOwnProperty("idempotency_key"))
                            if (!$util.isString(message.idempotency_key))
                                return "idempotency_key: string expected";
                        if (message.correlation_id != null && message.hasOwnProperty("correlation_id"))
                            if (!$util.isString(message.correlation_id))
                                return "correlation_id: string expected";
                        if (message.actor_user_id != null && message.hasOwnProperty("actor_user_id"))
                            if (!$util.isString(message.actor_user_id))
                                return "actor_user_id: string expected";
                        if (message.actor_type != null && message.hasOwnProperty("actor_type"))
                            if (!$util.isString(message.actor_type))
                                return "actor_type: string expected";
                        if (message.tenant_id != null && message.hasOwnProperty("tenant_id"))
                            if (!$util.isString(message.tenant_id))
                                return "tenant_id: string expected";
                        return null;
                    };

                    /**
                     * Creates a CommandContext message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.common.v1.CommandContext} CommandContext
                     */
                    CommandContext.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.common.v1.CommandContext)
                            return object;
                        let message = new $root.rntme.contracts.common.v1.CommandContext();
                        if (object.idempotency_key != null)
                            message.idempotency_key = String(object.idempotency_key);
                        if (object.correlation_id != null)
                            message.correlation_id = String(object.correlation_id);
                        if (object.actor_user_id != null)
                            message.actor_user_id = String(object.actor_user_id);
                        if (object.actor_type != null)
                            message.actor_type = String(object.actor_type);
                        if (object.tenant_id != null)
                            message.tenant_id = String(object.tenant_id);
                        return message;
                    };

                    /**
                     * Creates a plain object from a CommandContext message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @static
                     * @param {rntme.contracts.common.v1.CommandContext} message CommandContext
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    CommandContext.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.idempotency_key = "";
                            object.correlation_id = "";
                            object.actor_user_id = "";
                            object.actor_type = "";
                            object.tenant_id = "";
                        }
                        if (message.idempotency_key != null && message.hasOwnProperty("idempotency_key"))
                            object.idempotency_key = message.idempotency_key;
                        if (message.correlation_id != null && message.hasOwnProperty("correlation_id"))
                            object.correlation_id = message.correlation_id;
                        if (message.actor_user_id != null && message.hasOwnProperty("actor_user_id"))
                            object.actor_user_id = message.actor_user_id;
                        if (message.actor_type != null && message.hasOwnProperty("actor_type"))
                            object.actor_type = message.actor_type;
                        if (message.tenant_id != null && message.hasOwnProperty("tenant_id"))
                            object.tenant_id = message.tenant_id;
                        return object;
                    };

                    /**
                     * Converts this CommandContext to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    CommandContext.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for CommandContext
                     * @function getTypeUrl
                     * @memberof rntme.contracts.common.v1.CommandContext
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    CommandContext.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.common.v1.CommandContext";
                    };

                    return CommandContext;
                })();

                v1.Name = (function() {

                    /**
                     * Properties of a Name.
                     * @memberof rntme.contracts.common.v1
                     * @interface IName
                     * @property {string|null} [given] Name given
                     * @property {string|null} [family] Name family
                     * @property {string|null} [display] Name display
                     */

                    /**
                     * Constructs a new Name.
                     * @memberof rntme.contracts.common.v1
                     * @classdesc Represents a Name.
                     * @implements IName
                     * @constructor
                     * @param {rntme.contracts.common.v1.IName=} [properties] Properties to set
                     */
                    function Name(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Name given.
                     * @member {string} given
                     * @memberof rntme.contracts.common.v1.Name
                     * @instance
                     */
                    Name.prototype.given = "";

                    /**
                     * Name family.
                     * @member {string} family
                     * @memberof rntme.contracts.common.v1.Name
                     * @instance
                     */
                    Name.prototype.family = "";

                    /**
                     * Name display.
                     * @member {string} display
                     * @memberof rntme.contracts.common.v1.Name
                     * @instance
                     */
                    Name.prototype.display = "";

                    /**
                     * Creates a new Name instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.common.v1.Name
                     * @static
                     * @param {rntme.contracts.common.v1.IName=} [properties] Properties to set
                     * @returns {rntme.contracts.common.v1.Name} Name instance
                     */
                    Name.create = function create(properties) {
                        return new Name(properties);
                    };

                    /**
                     * Encodes the specified Name message. Does not implicitly {@link rntme.contracts.common.v1.Name.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.common.v1.Name
                     * @static
                     * @param {rntme.contracts.common.v1.IName} message Name message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Name.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.given != null && Object.hasOwnProperty.call(message, "given"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.given);
                        if (message.family != null && Object.hasOwnProperty.call(message, "family"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.family);
                        if (message.display != null && Object.hasOwnProperty.call(message, "display"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.display);
                        return writer;
                    };

                    /**
                     * Encodes the specified Name message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Name.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.common.v1.Name
                     * @static
                     * @param {rntme.contracts.common.v1.IName} message Name message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Name.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Name message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.common.v1.Name
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.common.v1.Name} Name
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Name.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.common.v1.Name();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.given = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.family = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.display = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Name message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.common.v1.Name
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.common.v1.Name} Name
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Name.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Name message.
                     * @function verify
                     * @memberof rntme.contracts.common.v1.Name
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Name.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.given != null && message.hasOwnProperty("given"))
                            if (!$util.isString(message.given))
                                return "given: string expected";
                        if (message.family != null && message.hasOwnProperty("family"))
                            if (!$util.isString(message.family))
                                return "family: string expected";
                        if (message.display != null && message.hasOwnProperty("display"))
                            if (!$util.isString(message.display))
                                return "display: string expected";
                        return null;
                    };

                    /**
                     * Creates a Name message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.common.v1.Name
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.common.v1.Name} Name
                     */
                    Name.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.common.v1.Name)
                            return object;
                        let message = new $root.rntme.contracts.common.v1.Name();
                        if (object.given != null)
                            message.given = String(object.given);
                        if (object.family != null)
                            message.family = String(object.family);
                        if (object.display != null)
                            message.display = String(object.display);
                        return message;
                    };

                    /**
                     * Creates a plain object from a Name message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.common.v1.Name
                     * @static
                     * @param {rntme.contracts.common.v1.Name} message Name
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Name.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.given = "";
                            object.family = "";
                            object.display = "";
                        }
                        if (message.given != null && message.hasOwnProperty("given"))
                            object.given = message.given;
                        if (message.family != null && message.hasOwnProperty("family"))
                            object.family = message.family;
                        if (message.display != null && message.hasOwnProperty("display"))
                            object.display = message.display;
                        return object;
                    };

                    /**
                     * Converts this Name to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.common.v1.Name
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Name.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Name
                     * @function getTypeUrl
                     * @memberof rntme.contracts.common.v1.Name
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Name.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.common.v1.Name";
                    };

                    return Name;
                })();

                v1.ListRequest = (function() {

                    /**
                     * Properties of a ListRequest.
                     * @memberof rntme.contracts.common.v1
                     * @interface IListRequest
                     * @property {number|null} [limit] ListRequest limit
                     * @property {string|null} [cursor] ListRequest cursor
                     * @property {number|null} [offset] ListRequest offset
                     * @property {Array.<rntme.contracts.common.v1.IFilter>|null} [filters] ListRequest filters
                     * @property {Array.<rntme.contracts.common.v1.ISort>|null} [sorts] ListRequest sorts
                     */

                    /**
                     * Constructs a new ListRequest.
                     * @memberof rntme.contracts.common.v1
                     * @classdesc Represents a ListRequest.
                     * @implements IListRequest
                     * @constructor
                     * @param {rntme.contracts.common.v1.IListRequest=} [properties] Properties to set
                     */
                    function ListRequest(properties) {
                        this.filters = [];
                        this.sorts = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ListRequest limit.
                     * @member {number} limit
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @instance
                     */
                    ListRequest.prototype.limit = 0;

                    /**
                     * ListRequest cursor.
                     * @member {string} cursor
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @instance
                     */
                    ListRequest.prototype.cursor = "";

                    /**
                     * ListRequest offset.
                     * @member {number} offset
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @instance
                     */
                    ListRequest.prototype.offset = 0;

                    /**
                     * ListRequest filters.
                     * @member {Array.<rntme.contracts.common.v1.IFilter>} filters
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @instance
                     */
                    ListRequest.prototype.filters = $util.emptyArray;

                    /**
                     * ListRequest sorts.
                     * @member {Array.<rntme.contracts.common.v1.ISort>} sorts
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @instance
                     */
                    ListRequest.prototype.sorts = $util.emptyArray;

                    /**
                     * Creates a new ListRequest instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @static
                     * @param {rntme.contracts.common.v1.IListRequest=} [properties] Properties to set
                     * @returns {rntme.contracts.common.v1.ListRequest} ListRequest instance
                     */
                    ListRequest.create = function create(properties) {
                        return new ListRequest(properties);
                    };

                    /**
                     * Encodes the specified ListRequest message. Does not implicitly {@link rntme.contracts.common.v1.ListRequest.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @static
                     * @param {rntme.contracts.common.v1.IListRequest} message ListRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ListRequest.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.limit != null && Object.hasOwnProperty.call(message, "limit"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.limit);
                        if (message.cursor != null && Object.hasOwnProperty.call(message, "cursor"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.cursor);
                        if (message.offset != null && Object.hasOwnProperty.call(message, "offset"))
                            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.offset);
                        if (message.filters != null && message.filters.length)
                            for (let i = 0; i < message.filters.length; ++i)
                                $root.rntme.contracts.common.v1.Filter.encode(message.filters[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
                        if (message.sorts != null && message.sorts.length)
                            for (let i = 0; i < message.sorts.length; ++i)
                                $root.rntme.contracts.common.v1.Sort.encode(message.sorts[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified ListRequest message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.ListRequest.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @static
                     * @param {rntme.contracts.common.v1.IListRequest} message ListRequest message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ListRequest.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ListRequest message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.common.v1.ListRequest} ListRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ListRequest.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.common.v1.ListRequest();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.limit = reader.int32();
                                    break;
                                }
                            case 2: {
                                    message.cursor = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.offset = reader.int32();
                                    break;
                                }
                            case 4: {
                                    if (!(message.filters && message.filters.length))
                                        message.filters = [];
                                    message.filters.push($root.rntme.contracts.common.v1.Filter.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 5: {
                                    if (!(message.sorts && message.sorts.length))
                                        message.sorts = [];
                                    message.sorts.push($root.rntme.contracts.common.v1.Sort.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ListRequest message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.common.v1.ListRequest} ListRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ListRequest.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ListRequest message.
                     * @function verify
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ListRequest.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.limit != null && message.hasOwnProperty("limit"))
                            if (!$util.isInteger(message.limit))
                                return "limit: integer expected";
                        if (message.cursor != null && message.hasOwnProperty("cursor"))
                            if (!$util.isString(message.cursor))
                                return "cursor: string expected";
                        if (message.offset != null && message.hasOwnProperty("offset"))
                            if (!$util.isInteger(message.offset))
                                return "offset: integer expected";
                        if (message.filters != null && message.hasOwnProperty("filters")) {
                            if (!Array.isArray(message.filters))
                                return "filters: array expected";
                            for (let i = 0; i < message.filters.length; ++i) {
                                let error = $root.rntme.contracts.common.v1.Filter.verify(message.filters[i]);
                                if (error)
                                    return "filters." + error;
                            }
                        }
                        if (message.sorts != null && message.hasOwnProperty("sorts")) {
                            if (!Array.isArray(message.sorts))
                                return "sorts: array expected";
                            for (let i = 0; i < message.sorts.length; ++i) {
                                let error = $root.rntme.contracts.common.v1.Sort.verify(message.sorts[i]);
                                if (error)
                                    return "sorts." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a ListRequest message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.common.v1.ListRequest} ListRequest
                     */
                    ListRequest.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.common.v1.ListRequest)
                            return object;
                        let message = new $root.rntme.contracts.common.v1.ListRequest();
                        if (object.limit != null)
                            message.limit = object.limit | 0;
                        if (object.cursor != null)
                            message.cursor = String(object.cursor);
                        if (object.offset != null)
                            message.offset = object.offset | 0;
                        if (object.filters) {
                            if (!Array.isArray(object.filters))
                                throw TypeError(".rntme.contracts.common.v1.ListRequest.filters: array expected");
                            message.filters = [];
                            for (let i = 0; i < object.filters.length; ++i) {
                                if (typeof object.filters[i] !== "object")
                                    throw TypeError(".rntme.contracts.common.v1.ListRequest.filters: object expected");
                                message.filters[i] = $root.rntme.contracts.common.v1.Filter.fromObject(object.filters[i]);
                            }
                        }
                        if (object.sorts) {
                            if (!Array.isArray(object.sorts))
                                throw TypeError(".rntme.contracts.common.v1.ListRequest.sorts: array expected");
                            message.sorts = [];
                            for (let i = 0; i < object.sorts.length; ++i) {
                                if (typeof object.sorts[i] !== "object")
                                    throw TypeError(".rntme.contracts.common.v1.ListRequest.sorts: object expected");
                                message.sorts[i] = $root.rntme.contracts.common.v1.Sort.fromObject(object.sorts[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a ListRequest message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @static
                     * @param {rntme.contracts.common.v1.ListRequest} message ListRequest
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ListRequest.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults) {
                            object.filters = [];
                            object.sorts = [];
                        }
                        if (options.defaults) {
                            object.limit = 0;
                            object.cursor = "";
                            object.offset = 0;
                        }
                        if (message.limit != null && message.hasOwnProperty("limit"))
                            object.limit = message.limit;
                        if (message.cursor != null && message.hasOwnProperty("cursor"))
                            object.cursor = message.cursor;
                        if (message.offset != null && message.hasOwnProperty("offset"))
                            object.offset = message.offset;
                        if (message.filters && message.filters.length) {
                            object.filters = [];
                            for (let j = 0; j < message.filters.length; ++j)
                                object.filters[j] = $root.rntme.contracts.common.v1.Filter.toObject(message.filters[j], options);
                        }
                        if (message.sorts && message.sorts.length) {
                            object.sorts = [];
                            for (let j = 0; j < message.sorts.length; ++j)
                                object.sorts[j] = $root.rntme.contracts.common.v1.Sort.toObject(message.sorts[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this ListRequest to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ListRequest.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ListRequest
                     * @function getTypeUrl
                     * @memberof rntme.contracts.common.v1.ListRequest
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ListRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.common.v1.ListRequest";
                    };

                    return ListRequest;
                })();

                v1.Filter = (function() {

                    /**
                     * Properties of a Filter.
                     * @memberof rntme.contracts.common.v1
                     * @interface IFilter
                     * @property {string|null} [field] Filter field
                     * @property {rntme.contracts.common.v1.FilterOperator|null} [operator] Filter operator
                     * @property {string|null} [value] Filter value
                     * @property {Array.<string>|null} [values] Filter values
                     */

                    /**
                     * Constructs a new Filter.
                     * @memberof rntme.contracts.common.v1
                     * @classdesc Represents a Filter.
                     * @implements IFilter
                     * @constructor
                     * @param {rntme.contracts.common.v1.IFilter=} [properties] Properties to set
                     */
                    function Filter(properties) {
                        this.values = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Filter field.
                     * @member {string} field
                     * @memberof rntme.contracts.common.v1.Filter
                     * @instance
                     */
                    Filter.prototype.field = "";

                    /**
                     * Filter operator.
                     * @member {rntme.contracts.common.v1.FilterOperator} operator
                     * @memberof rntme.contracts.common.v1.Filter
                     * @instance
                     */
                    Filter.prototype.operator = 0;

                    /**
                     * Filter value.
                     * @member {string} value
                     * @memberof rntme.contracts.common.v1.Filter
                     * @instance
                     */
                    Filter.prototype.value = "";

                    /**
                     * Filter values.
                     * @member {Array.<string>} values
                     * @memberof rntme.contracts.common.v1.Filter
                     * @instance
                     */
                    Filter.prototype.values = $util.emptyArray;

                    /**
                     * Creates a new Filter instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.common.v1.Filter
                     * @static
                     * @param {rntme.contracts.common.v1.IFilter=} [properties] Properties to set
                     * @returns {rntme.contracts.common.v1.Filter} Filter instance
                     */
                    Filter.create = function create(properties) {
                        return new Filter(properties);
                    };

                    /**
                     * Encodes the specified Filter message. Does not implicitly {@link rntme.contracts.common.v1.Filter.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.common.v1.Filter
                     * @static
                     * @param {rntme.contracts.common.v1.IFilter} message Filter message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Filter.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.field != null && Object.hasOwnProperty.call(message, "field"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.field);
                        if (message.operator != null && Object.hasOwnProperty.call(message, "operator"))
                            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.operator);
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.value);
                        if (message.values != null && message.values.length)
                            for (let i = 0; i < message.values.length; ++i)
                                writer.uint32(/* id 4, wireType 2 =*/34).string(message.values[i]);
                        return writer;
                    };

                    /**
                     * Encodes the specified Filter message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Filter.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.common.v1.Filter
                     * @static
                     * @param {rntme.contracts.common.v1.IFilter} message Filter message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Filter.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Filter message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.common.v1.Filter
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.common.v1.Filter} Filter
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Filter.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.common.v1.Filter();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.field = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.operator = reader.int32();
                                    break;
                                }
                            case 3: {
                                    message.value = reader.string();
                                    break;
                                }
                            case 4: {
                                    if (!(message.values && message.values.length))
                                        message.values = [];
                                    message.values.push(reader.string());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Filter message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.common.v1.Filter
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.common.v1.Filter} Filter
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Filter.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Filter message.
                     * @function verify
                     * @memberof rntme.contracts.common.v1.Filter
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Filter.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.field != null && message.hasOwnProperty("field"))
                            if (!$util.isString(message.field))
                                return "field: string expected";
                        if (message.operator != null && message.hasOwnProperty("operator"))
                            switch (message.operator) {
                            default:
                                return "operator: enum value expected";
                            case 0:
                            case 1:
                            case 2:
                            case 3:
                            case 4:
                            case 5:
                            case 6:
                            case 7:
                            case 8:
                            case 9:
                            case 10:
                            case 11:
                                break;
                            }
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (!$util.isString(message.value))
                                return "value: string expected";
                        if (message.values != null && message.hasOwnProperty("values")) {
                            if (!Array.isArray(message.values))
                                return "values: array expected";
                            for (let i = 0; i < message.values.length; ++i)
                                if (!$util.isString(message.values[i]))
                                    return "values: string[] expected";
                        }
                        return null;
                    };

                    /**
                     * Creates a Filter message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.common.v1.Filter
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.common.v1.Filter} Filter
                     */
                    Filter.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.common.v1.Filter)
                            return object;
                        let message = new $root.rntme.contracts.common.v1.Filter();
                        if (object.field != null)
                            message.field = String(object.field);
                        switch (object.operator) {
                        default:
                            if (typeof object.operator === "number") {
                                message.operator = object.operator;
                                break;
                            }
                            break;
                        case "FILTER_OPERATOR_UNSPECIFIED":
                        case 0:
                            message.operator = 0;
                            break;
                        case "FILTER_OPERATOR_EQ":
                        case 1:
                            message.operator = 1;
                            break;
                        case "FILTER_OPERATOR_NEQ":
                        case 2:
                            message.operator = 2;
                            break;
                        case "FILTER_OPERATOR_GT":
                        case 3:
                            message.operator = 3;
                            break;
                        case "FILTER_OPERATOR_GTE":
                        case 4:
                            message.operator = 4;
                            break;
                        case "FILTER_OPERATOR_LT":
                        case 5:
                            message.operator = 5;
                            break;
                        case "FILTER_OPERATOR_LTE":
                        case 6:
                            message.operator = 6;
                            break;
                        case "FILTER_OPERATOR_IN":
                        case 7:
                            message.operator = 7;
                            break;
                        case "FILTER_OPERATOR_NOT_IN":
                        case 8:
                            message.operator = 8;
                            break;
                        case "FILTER_OPERATOR_CONTAINS":
                        case 9:
                            message.operator = 9;
                            break;
                        case "FILTER_OPERATOR_PREFIX":
                        case 10:
                            message.operator = 10;
                            break;
                        case "FILTER_OPERATOR_SUFFIX":
                        case 11:
                            message.operator = 11;
                            break;
                        }
                        if (object.value != null)
                            message.value = String(object.value);
                        if (object.values) {
                            if (!Array.isArray(object.values))
                                throw TypeError(".rntme.contracts.common.v1.Filter.values: array expected");
                            message.values = [];
                            for (let i = 0; i < object.values.length; ++i)
                                message.values[i] = String(object.values[i]);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Filter message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.common.v1.Filter
                     * @static
                     * @param {rntme.contracts.common.v1.Filter} message Filter
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Filter.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.values = [];
                        if (options.defaults) {
                            object.field = "";
                            object.operator = options.enums === String ? "FILTER_OPERATOR_UNSPECIFIED" : 0;
                            object.value = "";
                        }
                        if (message.field != null && message.hasOwnProperty("field"))
                            object.field = message.field;
                        if (message.operator != null && message.hasOwnProperty("operator"))
                            object.operator = options.enums === String ? $root.rntme.contracts.common.v1.FilterOperator[message.operator] === undefined ? message.operator : $root.rntme.contracts.common.v1.FilterOperator[message.operator] : message.operator;
                        if (message.value != null && message.hasOwnProperty("value"))
                            object.value = message.value;
                        if (message.values && message.values.length) {
                            object.values = [];
                            for (let j = 0; j < message.values.length; ++j)
                                object.values[j] = message.values[j];
                        }
                        return object;
                    };

                    /**
                     * Converts this Filter to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.common.v1.Filter
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Filter.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Filter
                     * @function getTypeUrl
                     * @memberof rntme.contracts.common.v1.Filter
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Filter.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.common.v1.Filter";
                    };

                    return Filter;
                })();

                /**
                 * FilterOperator enum.
                 * @name rntme.contracts.common.v1.FilterOperator
                 * @enum {number}
                 * @property {number} FILTER_OPERATOR_UNSPECIFIED=0 FILTER_OPERATOR_UNSPECIFIED value
                 * @property {number} FILTER_OPERATOR_EQ=1 FILTER_OPERATOR_EQ value
                 * @property {number} FILTER_OPERATOR_NEQ=2 FILTER_OPERATOR_NEQ value
                 * @property {number} FILTER_OPERATOR_GT=3 FILTER_OPERATOR_GT value
                 * @property {number} FILTER_OPERATOR_GTE=4 FILTER_OPERATOR_GTE value
                 * @property {number} FILTER_OPERATOR_LT=5 FILTER_OPERATOR_LT value
                 * @property {number} FILTER_OPERATOR_LTE=6 FILTER_OPERATOR_LTE value
                 * @property {number} FILTER_OPERATOR_IN=7 FILTER_OPERATOR_IN value
                 * @property {number} FILTER_OPERATOR_NOT_IN=8 FILTER_OPERATOR_NOT_IN value
                 * @property {number} FILTER_OPERATOR_CONTAINS=9 FILTER_OPERATOR_CONTAINS value
                 * @property {number} FILTER_OPERATOR_PREFIX=10 FILTER_OPERATOR_PREFIX value
                 * @property {number} FILTER_OPERATOR_SUFFIX=11 FILTER_OPERATOR_SUFFIX value
                 */
                v1.FilterOperator = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "FILTER_OPERATOR_UNSPECIFIED"] = 0;
                    values[valuesById[1] = "FILTER_OPERATOR_EQ"] = 1;
                    values[valuesById[2] = "FILTER_OPERATOR_NEQ"] = 2;
                    values[valuesById[3] = "FILTER_OPERATOR_GT"] = 3;
                    values[valuesById[4] = "FILTER_OPERATOR_GTE"] = 4;
                    values[valuesById[5] = "FILTER_OPERATOR_LT"] = 5;
                    values[valuesById[6] = "FILTER_OPERATOR_LTE"] = 6;
                    values[valuesById[7] = "FILTER_OPERATOR_IN"] = 7;
                    values[valuesById[8] = "FILTER_OPERATOR_NOT_IN"] = 8;
                    values[valuesById[9] = "FILTER_OPERATOR_CONTAINS"] = 9;
                    values[valuesById[10] = "FILTER_OPERATOR_PREFIX"] = 10;
                    values[valuesById[11] = "FILTER_OPERATOR_SUFFIX"] = 11;
                    return values;
                })();

                v1.Sort = (function() {

                    /**
                     * Properties of a Sort.
                     * @memberof rntme.contracts.common.v1
                     * @interface ISort
                     * @property {string|null} [field] Sort field
                     * @property {rntme.contracts.common.v1.SortDirection|null} [direction] Sort direction
                     */

                    /**
                     * Constructs a new Sort.
                     * @memberof rntme.contracts.common.v1
                     * @classdesc Represents a Sort.
                     * @implements ISort
                     * @constructor
                     * @param {rntme.contracts.common.v1.ISort=} [properties] Properties to set
                     */
                    function Sort(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Sort field.
                     * @member {string} field
                     * @memberof rntme.contracts.common.v1.Sort
                     * @instance
                     */
                    Sort.prototype.field = "";

                    /**
                     * Sort direction.
                     * @member {rntme.contracts.common.v1.SortDirection} direction
                     * @memberof rntme.contracts.common.v1.Sort
                     * @instance
                     */
                    Sort.prototype.direction = 0;

                    /**
                     * Creates a new Sort instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.common.v1.Sort
                     * @static
                     * @param {rntme.contracts.common.v1.ISort=} [properties] Properties to set
                     * @returns {rntme.contracts.common.v1.Sort} Sort instance
                     */
                    Sort.create = function create(properties) {
                        return new Sort(properties);
                    };

                    /**
                     * Encodes the specified Sort message. Does not implicitly {@link rntme.contracts.common.v1.Sort.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.common.v1.Sort
                     * @static
                     * @param {rntme.contracts.common.v1.ISort} message Sort message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Sort.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.field != null && Object.hasOwnProperty.call(message, "field"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.field);
                        if (message.direction != null && Object.hasOwnProperty.call(message, "direction"))
                            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.direction);
                        return writer;
                    };

                    /**
                     * Encodes the specified Sort message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Sort.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.common.v1.Sort
                     * @static
                     * @param {rntme.contracts.common.v1.ISort} message Sort message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Sort.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Sort message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.common.v1.Sort
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.common.v1.Sort} Sort
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Sort.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.common.v1.Sort();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.field = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.direction = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Sort message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.common.v1.Sort
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.common.v1.Sort} Sort
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Sort.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Sort message.
                     * @function verify
                     * @memberof rntme.contracts.common.v1.Sort
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Sort.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.field != null && message.hasOwnProperty("field"))
                            if (!$util.isString(message.field))
                                return "field: string expected";
                        if (message.direction != null && message.hasOwnProperty("direction"))
                            switch (message.direction) {
                            default:
                                return "direction: enum value expected";
                            case 0:
                            case 1:
                            case 2:
                                break;
                            }
                        return null;
                    };

                    /**
                     * Creates a Sort message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.common.v1.Sort
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.common.v1.Sort} Sort
                     */
                    Sort.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.common.v1.Sort)
                            return object;
                        let message = new $root.rntme.contracts.common.v1.Sort();
                        if (object.field != null)
                            message.field = String(object.field);
                        switch (object.direction) {
                        default:
                            if (typeof object.direction === "number") {
                                message.direction = object.direction;
                                break;
                            }
                            break;
                        case "SORT_DIRECTION_UNSPECIFIED":
                        case 0:
                            message.direction = 0;
                            break;
                        case "SORT_DIRECTION_ASC":
                        case 1:
                            message.direction = 1;
                            break;
                        case "SORT_DIRECTION_DESC":
                        case 2:
                            message.direction = 2;
                            break;
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Sort message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.common.v1.Sort
                     * @static
                     * @param {rntme.contracts.common.v1.Sort} message Sort
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Sort.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.field = "";
                            object.direction = options.enums === String ? "SORT_DIRECTION_UNSPECIFIED" : 0;
                        }
                        if (message.field != null && message.hasOwnProperty("field"))
                            object.field = message.field;
                        if (message.direction != null && message.hasOwnProperty("direction"))
                            object.direction = options.enums === String ? $root.rntme.contracts.common.v1.SortDirection[message.direction] === undefined ? message.direction : $root.rntme.contracts.common.v1.SortDirection[message.direction] : message.direction;
                        return object;
                    };

                    /**
                     * Converts this Sort to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.common.v1.Sort
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Sort.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Sort
                     * @function getTypeUrl
                     * @memberof rntme.contracts.common.v1.Sort
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Sort.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.common.v1.Sort";
                    };

                    return Sort;
                })();

                /**
                 * SortDirection enum.
                 * @name rntme.contracts.common.v1.SortDirection
                 * @enum {number}
                 * @property {number} SORT_DIRECTION_UNSPECIFIED=0 SORT_DIRECTION_UNSPECIFIED value
                 * @property {number} SORT_DIRECTION_ASC=1 SORT_DIRECTION_ASC value
                 * @property {number} SORT_DIRECTION_DESC=2 SORT_DIRECTION_DESC value
                 */
                v1.SortDirection = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "SORT_DIRECTION_UNSPECIFIED"] = 0;
                    values[valuesById[1] = "SORT_DIRECTION_ASC"] = 1;
                    values[valuesById[2] = "SORT_DIRECTION_DESC"] = 2;
                    return values;
                })();

                v1.ListResponseMeta = (function() {

                    /**
                     * Properties of a ListResponseMeta.
                     * @memberof rntme.contracts.common.v1
                     * @interface IListResponseMeta
                     * @property {number|null} [limit] ListResponseMeta limit
                     * @property {string|null} [next_cursor] ListResponseMeta next_cursor
                     * @property {string|null} [prev_cursor] ListResponseMeta prev_cursor
                     * @property {number|null} [total_count] ListResponseMeta total_count
                     * @property {boolean|null} [has_more] ListResponseMeta has_more
                     */

                    /**
                     * Constructs a new ListResponseMeta.
                     * @memberof rntme.contracts.common.v1
                     * @classdesc Represents a ListResponseMeta.
                     * @implements IListResponseMeta
                     * @constructor
                     * @param {rntme.contracts.common.v1.IListResponseMeta=} [properties] Properties to set
                     */
                    function ListResponseMeta(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ListResponseMeta limit.
                     * @member {number} limit
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @instance
                     */
                    ListResponseMeta.prototype.limit = 0;

                    /**
                     * ListResponseMeta next_cursor.
                     * @member {string} next_cursor
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @instance
                     */
                    ListResponseMeta.prototype.next_cursor = "";

                    /**
                     * ListResponseMeta prev_cursor.
                     * @member {string} prev_cursor
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @instance
                     */
                    ListResponseMeta.prototype.prev_cursor = "";

                    /**
                     * ListResponseMeta total_count.
                     * @member {number} total_count
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @instance
                     */
                    ListResponseMeta.prototype.total_count = 0;

                    /**
                     * ListResponseMeta has_more.
                     * @member {boolean} has_more
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @instance
                     */
                    ListResponseMeta.prototype.has_more = false;

                    /**
                     * Creates a new ListResponseMeta instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @static
                     * @param {rntme.contracts.common.v1.IListResponseMeta=} [properties] Properties to set
                     * @returns {rntme.contracts.common.v1.ListResponseMeta} ListResponseMeta instance
                     */
                    ListResponseMeta.create = function create(properties) {
                        return new ListResponseMeta(properties);
                    };

                    /**
                     * Encodes the specified ListResponseMeta message. Does not implicitly {@link rntme.contracts.common.v1.ListResponseMeta.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @static
                     * @param {rntme.contracts.common.v1.IListResponseMeta} message ListResponseMeta message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ListResponseMeta.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.limit != null && Object.hasOwnProperty.call(message, "limit"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.limit);
                        if (message.next_cursor != null && Object.hasOwnProperty.call(message, "next_cursor"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.next_cursor);
                        if (message.prev_cursor != null && Object.hasOwnProperty.call(message, "prev_cursor"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.prev_cursor);
                        if (message.total_count != null && Object.hasOwnProperty.call(message, "total_count"))
                            writer.uint32(/* id 4, wireType 0 =*/32).int32(message.total_count);
                        if (message.has_more != null && Object.hasOwnProperty.call(message, "has_more"))
                            writer.uint32(/* id 5, wireType 0 =*/40).bool(message.has_more);
                        return writer;
                    };

                    /**
                     * Encodes the specified ListResponseMeta message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.ListResponseMeta.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @static
                     * @param {rntme.contracts.common.v1.IListResponseMeta} message ListResponseMeta message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ListResponseMeta.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ListResponseMeta message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.common.v1.ListResponseMeta} ListResponseMeta
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ListResponseMeta.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.common.v1.ListResponseMeta();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.limit = reader.int32();
                                    break;
                                }
                            case 2: {
                                    message.next_cursor = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.prev_cursor = reader.string();
                                    break;
                                }
                            case 4: {
                                    message.total_count = reader.int32();
                                    break;
                                }
                            case 5: {
                                    message.has_more = reader.bool();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ListResponseMeta message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.common.v1.ListResponseMeta} ListResponseMeta
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ListResponseMeta.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ListResponseMeta message.
                     * @function verify
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ListResponseMeta.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.limit != null && message.hasOwnProperty("limit"))
                            if (!$util.isInteger(message.limit))
                                return "limit: integer expected";
                        if (message.next_cursor != null && message.hasOwnProperty("next_cursor"))
                            if (!$util.isString(message.next_cursor))
                                return "next_cursor: string expected";
                        if (message.prev_cursor != null && message.hasOwnProperty("prev_cursor"))
                            if (!$util.isString(message.prev_cursor))
                                return "prev_cursor: string expected";
                        if (message.total_count != null && message.hasOwnProperty("total_count"))
                            if (!$util.isInteger(message.total_count))
                                return "total_count: integer expected";
                        if (message.has_more != null && message.hasOwnProperty("has_more"))
                            if (typeof message.has_more !== "boolean")
                                return "has_more: boolean expected";
                        return null;
                    };

                    /**
                     * Creates a ListResponseMeta message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.common.v1.ListResponseMeta} ListResponseMeta
                     */
                    ListResponseMeta.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.common.v1.ListResponseMeta)
                            return object;
                        let message = new $root.rntme.contracts.common.v1.ListResponseMeta();
                        if (object.limit != null)
                            message.limit = object.limit | 0;
                        if (object.next_cursor != null)
                            message.next_cursor = String(object.next_cursor);
                        if (object.prev_cursor != null)
                            message.prev_cursor = String(object.prev_cursor);
                        if (object.total_count != null)
                            message.total_count = object.total_count | 0;
                        if (object.has_more != null)
                            message.has_more = Boolean(object.has_more);
                        return message;
                    };

                    /**
                     * Creates a plain object from a ListResponseMeta message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @static
                     * @param {rntme.contracts.common.v1.ListResponseMeta} message ListResponseMeta
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ListResponseMeta.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.limit = 0;
                            object.next_cursor = "";
                            object.prev_cursor = "";
                            object.total_count = 0;
                            object.has_more = false;
                        }
                        if (message.limit != null && message.hasOwnProperty("limit"))
                            object.limit = message.limit;
                        if (message.next_cursor != null && message.hasOwnProperty("next_cursor"))
                            object.next_cursor = message.next_cursor;
                        if (message.prev_cursor != null && message.hasOwnProperty("prev_cursor"))
                            object.prev_cursor = message.prev_cursor;
                        if (message.total_count != null && message.hasOwnProperty("total_count"))
                            object.total_count = message.total_count;
                        if (message.has_more != null && message.hasOwnProperty("has_more"))
                            object.has_more = message.has_more;
                        return object;
                    };

                    /**
                     * Converts this ListResponseMeta to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ListResponseMeta.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ListResponseMeta
                     * @function getTypeUrl
                     * @memberof rntme.contracts.common.v1.ListResponseMeta
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ListResponseMeta.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.common.v1.ListResponseMeta";
                    };

                    return ListResponseMeta;
                })();

                v1.Metadata = (function() {

                    /**
                     * Properties of a Metadata.
                     * @memberof rntme.contracts.common.v1
                     * @interface IMetadata
                     * @property {google.protobuf.IStruct|null} ["public"] Metadata public
                     * @property {google.protobuf.IStruct|null} ["private"] Metadata private
                     * @property {google.protobuf.IStruct|null} [unsafe] Metadata unsafe
                     */

                    /**
                     * Constructs a new Metadata.
                     * @memberof rntme.contracts.common.v1
                     * @classdesc Represents a Metadata.
                     * @implements IMetadata
                     * @constructor
                     * @param {rntme.contracts.common.v1.IMetadata=} [properties] Properties to set
                     */
                    function Metadata(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Metadata public.
                     * @member {google.protobuf.IStruct|null|undefined} public
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @instance
                     */
                    Metadata.prototype["public"] = null;

                    /**
                     * Metadata private.
                     * @member {google.protobuf.IStruct|null|undefined} private
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @instance
                     */
                    Metadata.prototype["private"] = null;

                    /**
                     * Metadata unsafe.
                     * @member {google.protobuf.IStruct|null|undefined} unsafe
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @instance
                     */
                    Metadata.prototype.unsafe = null;

                    /**
                     * Creates a new Metadata instance using the specified properties.
                     * @function create
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @static
                     * @param {rntme.contracts.common.v1.IMetadata=} [properties] Properties to set
                     * @returns {rntme.contracts.common.v1.Metadata} Metadata instance
                     */
                    Metadata.create = function create(properties) {
                        return new Metadata(properties);
                    };

                    /**
                     * Encodes the specified Metadata message. Does not implicitly {@link rntme.contracts.common.v1.Metadata.verify|verify} messages.
                     * @function encode
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @static
                     * @param {rntme.contracts.common.v1.IMetadata} message Metadata message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Metadata.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message["public"] != null && Object.hasOwnProperty.call(message, "public"))
                            $root.google.protobuf.Struct.encode(message["public"], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message["private"] != null && Object.hasOwnProperty.call(message, "private"))
                            $root.google.protobuf.Struct.encode(message["private"], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.unsafe != null && Object.hasOwnProperty.call(message, "unsafe"))
                            $root.google.protobuf.Struct.encode(message.unsafe, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified Metadata message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Metadata.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @static
                     * @param {rntme.contracts.common.v1.IMetadata} message Metadata message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Metadata.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Metadata message from the specified reader or buffer.
                     * @function decode
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {rntme.contracts.common.v1.Metadata} Metadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Metadata.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.rntme.contracts.common.v1.Metadata();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message["public"] = $root.google.protobuf.Struct.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message["private"] = $root.google.protobuf.Struct.decode(reader, reader.uint32());
                                    break;
                                }
                            case 3: {
                                    message.unsafe = $root.google.protobuf.Struct.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Metadata message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {rntme.contracts.common.v1.Metadata} Metadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Metadata.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Metadata message.
                     * @function verify
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Metadata.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message["public"] != null && message.hasOwnProperty("public")) {
                            let error = $root.google.protobuf.Struct.verify(message["public"]);
                            if (error)
                                return "public." + error;
                        }
                        if (message["private"] != null && message.hasOwnProperty("private")) {
                            let error = $root.google.protobuf.Struct.verify(message["private"]);
                            if (error)
                                return "private." + error;
                        }
                        if (message.unsafe != null && message.hasOwnProperty("unsafe")) {
                            let error = $root.google.protobuf.Struct.verify(message.unsafe);
                            if (error)
                                return "unsafe." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a Metadata message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {rntme.contracts.common.v1.Metadata} Metadata
                     */
                    Metadata.fromObject = function fromObject(object) {
                        if (object instanceof $root.rntme.contracts.common.v1.Metadata)
                            return object;
                        let message = new $root.rntme.contracts.common.v1.Metadata();
                        if (object["public"] != null) {
                            if (typeof object["public"] !== "object")
                                throw TypeError(".rntme.contracts.common.v1.Metadata.public: object expected");
                            message["public"] = $root.google.protobuf.Struct.fromObject(object["public"]);
                        }
                        if (object["private"] != null) {
                            if (typeof object["private"] !== "object")
                                throw TypeError(".rntme.contracts.common.v1.Metadata.private: object expected");
                            message["private"] = $root.google.protobuf.Struct.fromObject(object["private"]);
                        }
                        if (object.unsafe != null) {
                            if (typeof object.unsafe !== "object")
                                throw TypeError(".rntme.contracts.common.v1.Metadata.unsafe: object expected");
                            message.unsafe = $root.google.protobuf.Struct.fromObject(object.unsafe);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Metadata message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @static
                     * @param {rntme.contracts.common.v1.Metadata} message Metadata
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Metadata.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object["public"] = null;
                            object["private"] = null;
                            object.unsafe = null;
                        }
                        if (message["public"] != null && message.hasOwnProperty("public"))
                            object["public"] = $root.google.protobuf.Struct.toObject(message["public"], options);
                        if (message["private"] != null && message.hasOwnProperty("private"))
                            object["private"] = $root.google.protobuf.Struct.toObject(message["private"], options);
                        if (message.unsafe != null && message.hasOwnProperty("unsafe"))
                            object.unsafe = $root.google.protobuf.Struct.toObject(message.unsafe, options);
                        return object;
                    };

                    /**
                     * Converts this Metadata to JSON.
                     * @function toJSON
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Metadata.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Metadata
                     * @function getTypeUrl
                     * @memberof rntme.contracts.common.v1.Metadata
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Metadata.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/rntme.contracts.common.v1.Metadata";
                    };

                    return Metadata;
                })();

                return v1;
            })();

            return common;
        })();

        return contracts;
    })();

    return rntme;
})();

export const google = $root.google = (() => {

    /**
     * Namespace google.
     * @exports google
     * @namespace
     */
    const google = {};

    google.protobuf = (function() {

        /**
         * Namespace protobuf.
         * @memberof google
         * @namespace
         */
        const protobuf = {};

        protobuf.Timestamp = (function() {

            /**
             * Properties of a Timestamp.
             * @memberof google.protobuf
             * @interface ITimestamp
             * @property {number|Long|null} [seconds] Timestamp seconds
             * @property {number|null} [nanos] Timestamp nanos
             */

            /**
             * Constructs a new Timestamp.
             * @memberof google.protobuf
             * @classdesc Represents a Timestamp.
             * @implements ITimestamp
             * @constructor
             * @param {google.protobuf.ITimestamp=} [properties] Properties to set
             */
            function Timestamp(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Timestamp seconds.
             * @member {number|Long} seconds
             * @memberof google.protobuf.Timestamp
             * @instance
             */
            Timestamp.prototype.seconds = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

            /**
             * Timestamp nanos.
             * @member {number} nanos
             * @memberof google.protobuf.Timestamp
             * @instance
             */
            Timestamp.prototype.nanos = 0;

            /**
             * Creates a new Timestamp instance using the specified properties.
             * @function create
             * @memberof google.protobuf.Timestamp
             * @static
             * @param {google.protobuf.ITimestamp=} [properties] Properties to set
             * @returns {google.protobuf.Timestamp} Timestamp instance
             */
            Timestamp.create = function create(properties) {
                return new Timestamp(properties);
            };

            /**
             * Encodes the specified Timestamp message. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.Timestamp
             * @static
             * @param {google.protobuf.ITimestamp} message Timestamp message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Timestamp.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.seconds != null && Object.hasOwnProperty.call(message, "seconds"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int64(message.seconds);
                if (message.nanos != null && Object.hasOwnProperty.call(message, "nanos"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.nanos);
                return writer;
            };

            /**
             * Encodes the specified Timestamp message, length delimited. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.Timestamp
             * @static
             * @param {google.protobuf.ITimestamp} message Timestamp message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Timestamp.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a Timestamp message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.Timestamp
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.Timestamp} Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Timestamp.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.Timestamp();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.seconds = reader.int64();
                            break;
                        }
                    case 2: {
                            message.nanos = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a Timestamp message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.Timestamp
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.Timestamp} Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Timestamp.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a Timestamp message.
             * @function verify
             * @memberof google.protobuf.Timestamp
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Timestamp.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.seconds != null && message.hasOwnProperty("seconds"))
                    if (!$util.isInteger(message.seconds) && !(message.seconds && $util.isInteger(message.seconds.low) && $util.isInteger(message.seconds.high)))
                        return "seconds: integer|Long expected";
                if (message.nanos != null && message.hasOwnProperty("nanos"))
                    if (!$util.isInteger(message.nanos))
                        return "nanos: integer expected";
                return null;
            };

            /**
             * Creates a Timestamp message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.Timestamp
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.Timestamp} Timestamp
             */
            Timestamp.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.Timestamp)
                    return object;
                let message = new $root.google.protobuf.Timestamp();
                if (object.seconds != null)
                    if ($util.Long)
                        (message.seconds = $util.Long.fromValue(object.seconds)).unsigned = false;
                    else if (typeof object.seconds === "string")
                        message.seconds = parseInt(object.seconds, 10);
                    else if (typeof object.seconds === "number")
                        message.seconds = object.seconds;
                    else if (typeof object.seconds === "object")
                        message.seconds = new $util.LongBits(object.seconds.low >>> 0, object.seconds.high >>> 0).toNumber();
                if (object.nanos != null)
                    message.nanos = object.nanos | 0;
                return message;
            };

            /**
             * Creates a plain object from a Timestamp message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.Timestamp
             * @static
             * @param {google.protobuf.Timestamp} message Timestamp
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Timestamp.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, false);
                        object.seconds = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.seconds = options.longs === String ? "0" : 0;
                    object.nanos = 0;
                }
                if (message.seconds != null && message.hasOwnProperty("seconds"))
                    if (typeof message.seconds === "number")
                        object.seconds = options.longs === String ? String(message.seconds) : message.seconds;
                    else
                        object.seconds = options.longs === String ? $util.Long.prototype.toString.call(message.seconds) : options.longs === Number ? new $util.LongBits(message.seconds.low >>> 0, message.seconds.high >>> 0).toNumber() : message.seconds;
                if (message.nanos != null && message.hasOwnProperty("nanos"))
                    object.nanos = message.nanos;
                return object;
            };

            /**
             * Converts this Timestamp to JSON.
             * @function toJSON
             * @memberof google.protobuf.Timestamp
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Timestamp.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Timestamp
             * @function getTypeUrl
             * @memberof google.protobuf.Timestamp
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Timestamp.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.Timestamp";
            };

            return Timestamp;
        })();

        protobuf.Struct = (function() {

            /**
             * Properties of a Struct.
             * @memberof google.protobuf
             * @interface IStruct
             * @property {Object.<string,google.protobuf.IValue>|null} [fields] Struct fields
             */

            /**
             * Constructs a new Struct.
             * @memberof google.protobuf
             * @classdesc Represents a Struct.
             * @implements IStruct
             * @constructor
             * @param {google.protobuf.IStruct=} [properties] Properties to set
             */
            function Struct(properties) {
                this.fields = {};
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Struct fields.
             * @member {Object.<string,google.protobuf.IValue>} fields
             * @memberof google.protobuf.Struct
             * @instance
             */
            Struct.prototype.fields = $util.emptyObject;

            /**
             * Creates a new Struct instance using the specified properties.
             * @function create
             * @memberof google.protobuf.Struct
             * @static
             * @param {google.protobuf.IStruct=} [properties] Properties to set
             * @returns {google.protobuf.Struct} Struct instance
             */
            Struct.create = function create(properties) {
                return new Struct(properties);
            };

            /**
             * Encodes the specified Struct message. Does not implicitly {@link google.protobuf.Struct.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.Struct
             * @static
             * @param {google.protobuf.IStruct} message Struct message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Struct.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.fields != null && Object.hasOwnProperty.call(message, "fields"))
                    for (let keys = Object.keys(message.fields), i = 0; i < keys.length; ++i) {
                        writer.uint32(/* id 1, wireType 2 =*/10).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                        $root.google.protobuf.Value.encode(message.fields[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim().ldelim();
                    }
                return writer;
            };

            /**
             * Encodes the specified Struct message, length delimited. Does not implicitly {@link google.protobuf.Struct.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.Struct
             * @static
             * @param {google.protobuf.IStruct} message Struct message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Struct.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a Struct message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.Struct
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.Struct} Struct
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Struct.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.Struct(), key, value;
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            if (message.fields === $util.emptyObject)
                                message.fields = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = null;
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = $root.google.protobuf.Value.decode(reader, reader.uint32());
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.fields[key] = value;
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a Struct message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.Struct
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.Struct} Struct
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Struct.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a Struct message.
             * @function verify
             * @memberof google.protobuf.Struct
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Struct.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.fields != null && message.hasOwnProperty("fields")) {
                    if (!$util.isObject(message.fields))
                        return "fields: object expected";
                    let key = Object.keys(message.fields);
                    for (let i = 0; i < key.length; ++i) {
                        let error = $root.google.protobuf.Value.verify(message.fields[key[i]]);
                        if (error)
                            return "fields." + error;
                    }
                }
                return null;
            };

            /**
             * Creates a Struct message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.Struct
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.Struct} Struct
             */
            Struct.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.Struct)
                    return object;
                let message = new $root.google.protobuf.Struct();
                if (object.fields) {
                    if (typeof object.fields !== "object")
                        throw TypeError(".google.protobuf.Struct.fields: object expected");
                    message.fields = {};
                    for (let keys = Object.keys(object.fields), i = 0; i < keys.length; ++i) {
                        if (typeof object.fields[keys[i]] !== "object")
                            throw TypeError(".google.protobuf.Struct.fields: object expected");
                        message.fields[keys[i]] = $root.google.protobuf.Value.fromObject(object.fields[keys[i]]);
                    }
                }
                return message;
            };

            /**
             * Creates a plain object from a Struct message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.Struct
             * @static
             * @param {google.protobuf.Struct} message Struct
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Struct.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.objects || options.defaults)
                    object.fields = {};
                let keys2;
                if (message.fields && (keys2 = Object.keys(message.fields)).length) {
                    object.fields = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.fields[keys2[j]] = $root.google.protobuf.Value.toObject(message.fields[keys2[j]], options);
                }
                return object;
            };

            /**
             * Converts this Struct to JSON.
             * @function toJSON
             * @memberof google.protobuf.Struct
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Struct.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Struct
             * @function getTypeUrl
             * @memberof google.protobuf.Struct
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Struct.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.Struct";
            };

            return Struct;
        })();

        protobuf.Value = (function() {

            /**
             * Properties of a Value.
             * @memberof google.protobuf
             * @interface IValue
             * @property {google.protobuf.NullValue|null} [nullValue] Value nullValue
             * @property {number|null} [numberValue] Value numberValue
             * @property {string|null} [stringValue] Value stringValue
             * @property {boolean|null} [boolValue] Value boolValue
             * @property {google.protobuf.IStruct|null} [structValue] Value structValue
             * @property {google.protobuf.IListValue|null} [listValue] Value listValue
             */

            /**
             * Constructs a new Value.
             * @memberof google.protobuf
             * @classdesc Represents a Value.
             * @implements IValue
             * @constructor
             * @param {google.protobuf.IValue=} [properties] Properties to set
             */
            function Value(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Value nullValue.
             * @member {google.protobuf.NullValue|null|undefined} nullValue
             * @memberof google.protobuf.Value
             * @instance
             */
            Value.prototype.nullValue = null;

            /**
             * Value numberValue.
             * @member {number|null|undefined} numberValue
             * @memberof google.protobuf.Value
             * @instance
             */
            Value.prototype.numberValue = null;

            /**
             * Value stringValue.
             * @member {string|null|undefined} stringValue
             * @memberof google.protobuf.Value
             * @instance
             */
            Value.prototype.stringValue = null;

            /**
             * Value boolValue.
             * @member {boolean|null|undefined} boolValue
             * @memberof google.protobuf.Value
             * @instance
             */
            Value.prototype.boolValue = null;

            /**
             * Value structValue.
             * @member {google.protobuf.IStruct|null|undefined} structValue
             * @memberof google.protobuf.Value
             * @instance
             */
            Value.prototype.structValue = null;

            /**
             * Value listValue.
             * @member {google.protobuf.IListValue|null|undefined} listValue
             * @memberof google.protobuf.Value
             * @instance
             */
            Value.prototype.listValue = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            /**
             * Value kind.
             * @member {"nullValue"|"numberValue"|"stringValue"|"boolValue"|"structValue"|"listValue"|undefined} kind
             * @memberof google.protobuf.Value
             * @instance
             */
            Object.defineProperty(Value.prototype, "kind", {
                get: $util.oneOfGetter($oneOfFields = ["nullValue", "numberValue", "stringValue", "boolValue", "structValue", "listValue"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new Value instance using the specified properties.
             * @function create
             * @memberof google.protobuf.Value
             * @static
             * @param {google.protobuf.IValue=} [properties] Properties to set
             * @returns {google.protobuf.Value} Value instance
             */
            Value.create = function create(properties) {
                return new Value(properties);
            };

            /**
             * Encodes the specified Value message. Does not implicitly {@link google.protobuf.Value.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.Value
             * @static
             * @param {google.protobuf.IValue} message Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Value.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.nullValue != null && Object.hasOwnProperty.call(message, "nullValue"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.nullValue);
                if (message.numberValue != null && Object.hasOwnProperty.call(message, "numberValue"))
                    writer.uint32(/* id 2, wireType 1 =*/17).double(message.numberValue);
                if (message.stringValue != null && Object.hasOwnProperty.call(message, "stringValue"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.stringValue);
                if (message.boolValue != null && Object.hasOwnProperty.call(message, "boolValue"))
                    writer.uint32(/* id 4, wireType 0 =*/32).bool(message.boolValue);
                if (message.structValue != null && Object.hasOwnProperty.call(message, "structValue"))
                    $root.google.protobuf.Struct.encode(message.structValue, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                if (message.listValue != null && Object.hasOwnProperty.call(message, "listValue"))
                    $root.google.protobuf.ListValue.encode(message.listValue, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified Value message, length delimited. Does not implicitly {@link google.protobuf.Value.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.Value
             * @static
             * @param {google.protobuf.IValue} message Value message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Value.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a Value message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.Value} Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Value.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.Value();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.nullValue = reader.int32();
                            break;
                        }
                    case 2: {
                            message.numberValue = reader.double();
                            break;
                        }
                    case 3: {
                            message.stringValue = reader.string();
                            break;
                        }
                    case 4: {
                            message.boolValue = reader.bool();
                            break;
                        }
                    case 5: {
                            message.structValue = $root.google.protobuf.Struct.decode(reader, reader.uint32());
                            break;
                        }
                    case 6: {
                            message.listValue = $root.google.protobuf.ListValue.decode(reader, reader.uint32());
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a Value message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.Value
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.Value} Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Value.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a Value message.
             * @function verify
             * @memberof google.protobuf.Value
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Value.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                let properties = {};
                if (message.nullValue != null && message.hasOwnProperty("nullValue")) {
                    properties.kind = 1;
                    switch (message.nullValue) {
                    default:
                        return "nullValue: enum value expected";
                    case 0:
                        break;
                    }
                }
                if (message.numberValue != null && message.hasOwnProperty("numberValue")) {
                    if (properties.kind === 1)
                        return "kind: multiple values";
                    properties.kind = 1;
                    if (typeof message.numberValue !== "number")
                        return "numberValue: number expected";
                }
                if (message.stringValue != null && message.hasOwnProperty("stringValue")) {
                    if (properties.kind === 1)
                        return "kind: multiple values";
                    properties.kind = 1;
                    if (!$util.isString(message.stringValue))
                        return "stringValue: string expected";
                }
                if (message.boolValue != null && message.hasOwnProperty("boolValue")) {
                    if (properties.kind === 1)
                        return "kind: multiple values";
                    properties.kind = 1;
                    if (typeof message.boolValue !== "boolean")
                        return "boolValue: boolean expected";
                }
                if (message.structValue != null && message.hasOwnProperty("structValue")) {
                    if (properties.kind === 1)
                        return "kind: multiple values";
                    properties.kind = 1;
                    {
                        let error = $root.google.protobuf.Struct.verify(message.structValue);
                        if (error)
                            return "structValue." + error;
                    }
                }
                if (message.listValue != null && message.hasOwnProperty("listValue")) {
                    if (properties.kind === 1)
                        return "kind: multiple values";
                    properties.kind = 1;
                    {
                        let error = $root.google.protobuf.ListValue.verify(message.listValue);
                        if (error)
                            return "listValue." + error;
                    }
                }
                return null;
            };

            /**
             * Creates a Value message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.Value
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.Value} Value
             */
            Value.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.Value)
                    return object;
                let message = new $root.google.protobuf.Value();
                switch (object.nullValue) {
                default:
                    if (typeof object.nullValue === "number") {
                        message.nullValue = object.nullValue;
                        break;
                    }
                    break;
                case "NULL_VALUE":
                case 0:
                    message.nullValue = 0;
                    break;
                }
                if (object.numberValue != null)
                    message.numberValue = Number(object.numberValue);
                if (object.stringValue != null)
                    message.stringValue = String(object.stringValue);
                if (object.boolValue != null)
                    message.boolValue = Boolean(object.boolValue);
                if (object.structValue != null) {
                    if (typeof object.structValue !== "object")
                        throw TypeError(".google.protobuf.Value.structValue: object expected");
                    message.structValue = $root.google.protobuf.Struct.fromObject(object.structValue);
                }
                if (object.listValue != null) {
                    if (typeof object.listValue !== "object")
                        throw TypeError(".google.protobuf.Value.listValue: object expected");
                    message.listValue = $root.google.protobuf.ListValue.fromObject(object.listValue);
                }
                return message;
            };

            /**
             * Creates a plain object from a Value message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.Value
             * @static
             * @param {google.protobuf.Value} message Value
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Value.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (message.nullValue != null && message.hasOwnProperty("nullValue")) {
                    object.nullValue = options.enums === String ? $root.google.protobuf.NullValue[message.nullValue] === undefined ? message.nullValue : $root.google.protobuf.NullValue[message.nullValue] : message.nullValue;
                    if (options.oneofs)
                        object.kind = "nullValue";
                }
                if (message.numberValue != null && message.hasOwnProperty("numberValue")) {
                    object.numberValue = options.json && !isFinite(message.numberValue) ? String(message.numberValue) : message.numberValue;
                    if (options.oneofs)
                        object.kind = "numberValue";
                }
                if (message.stringValue != null && message.hasOwnProperty("stringValue")) {
                    object.stringValue = message.stringValue;
                    if (options.oneofs)
                        object.kind = "stringValue";
                }
                if (message.boolValue != null && message.hasOwnProperty("boolValue")) {
                    object.boolValue = message.boolValue;
                    if (options.oneofs)
                        object.kind = "boolValue";
                }
                if (message.structValue != null && message.hasOwnProperty("structValue")) {
                    object.structValue = $root.google.protobuf.Struct.toObject(message.structValue, options);
                    if (options.oneofs)
                        object.kind = "structValue";
                }
                if (message.listValue != null && message.hasOwnProperty("listValue")) {
                    object.listValue = $root.google.protobuf.ListValue.toObject(message.listValue, options);
                    if (options.oneofs)
                        object.kind = "listValue";
                }
                return object;
            };

            /**
             * Converts this Value to JSON.
             * @function toJSON
             * @memberof google.protobuf.Value
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Value.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Value
             * @function getTypeUrl
             * @memberof google.protobuf.Value
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Value.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.Value";
            };

            return Value;
        })();

        /**
         * NullValue enum.
         * @name google.protobuf.NullValue
         * @enum {number}
         * @property {number} NULL_VALUE=0 NULL_VALUE value
         */
        protobuf.NullValue = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "NULL_VALUE"] = 0;
            return values;
        })();

        protobuf.ListValue = (function() {

            /**
             * Properties of a ListValue.
             * @memberof google.protobuf
             * @interface IListValue
             * @property {Array.<google.protobuf.IValue>|null} [values] ListValue values
             */

            /**
             * Constructs a new ListValue.
             * @memberof google.protobuf
             * @classdesc Represents a ListValue.
             * @implements IListValue
             * @constructor
             * @param {google.protobuf.IListValue=} [properties] Properties to set
             */
            function ListValue(properties) {
                this.values = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * ListValue values.
             * @member {Array.<google.protobuf.IValue>} values
             * @memberof google.protobuf.ListValue
             * @instance
             */
            ListValue.prototype.values = $util.emptyArray;

            /**
             * Creates a new ListValue instance using the specified properties.
             * @function create
             * @memberof google.protobuf.ListValue
             * @static
             * @param {google.protobuf.IListValue=} [properties] Properties to set
             * @returns {google.protobuf.ListValue} ListValue instance
             */
            ListValue.create = function create(properties) {
                return new ListValue(properties);
            };

            /**
             * Encodes the specified ListValue message. Does not implicitly {@link google.protobuf.ListValue.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.ListValue
             * @static
             * @param {google.protobuf.IListValue} message ListValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ListValue.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.values != null && message.values.length)
                    for (let i = 0; i < message.values.length; ++i)
                        $root.google.protobuf.Value.encode(message.values[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified ListValue message, length delimited. Does not implicitly {@link google.protobuf.ListValue.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.ListValue
             * @static
             * @param {google.protobuf.IListValue} message ListValue message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ListValue.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a ListValue message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.ListValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.ListValue} ListValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ListValue.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.ListValue();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            if (!(message.values && message.values.length))
                                message.values = [];
                            message.values.push($root.google.protobuf.Value.decode(reader, reader.uint32()));
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a ListValue message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.ListValue
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.ListValue} ListValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ListValue.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a ListValue message.
             * @function verify
             * @memberof google.protobuf.ListValue
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            ListValue.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.values != null && message.hasOwnProperty("values")) {
                    if (!Array.isArray(message.values))
                        return "values: array expected";
                    for (let i = 0; i < message.values.length; ++i) {
                        let error = $root.google.protobuf.Value.verify(message.values[i]);
                        if (error)
                            return "values." + error;
                    }
                }
                return null;
            };

            /**
             * Creates a ListValue message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.ListValue
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.ListValue} ListValue
             */
            ListValue.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.ListValue)
                    return object;
                let message = new $root.google.protobuf.ListValue();
                if (object.values) {
                    if (!Array.isArray(object.values))
                        throw TypeError(".google.protobuf.ListValue.values: array expected");
                    message.values = [];
                    for (let i = 0; i < object.values.length; ++i) {
                        if (typeof object.values[i] !== "object")
                            throw TypeError(".google.protobuf.ListValue.values: object expected");
                        message.values[i] = $root.google.protobuf.Value.fromObject(object.values[i]);
                    }
                }
                return message;
            };

            /**
             * Creates a plain object from a ListValue message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.ListValue
             * @static
             * @param {google.protobuf.ListValue} message ListValue
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            ListValue.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.arrays || options.defaults)
                    object.values = [];
                if (message.values && message.values.length) {
                    object.values = [];
                    for (let j = 0; j < message.values.length; ++j)
                        object.values[j] = $root.google.protobuf.Value.toObject(message.values[j], options);
                }
                return object;
            };

            /**
             * Converts this ListValue to JSON.
             * @function toJSON
             * @memberof google.protobuf.ListValue
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            ListValue.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for ListValue
             * @function getTypeUrl
             * @memberof google.protobuf.ListValue
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            ListValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/google.protobuf.ListValue";
            };

            return ListValue;
        })();

        return protobuf;
    })();

    return google;
})();

export { $root as default };
