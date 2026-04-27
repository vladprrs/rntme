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
