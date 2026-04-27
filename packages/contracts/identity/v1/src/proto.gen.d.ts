import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace rntme. */
export namespace rntme {

    /** Namespace contracts. */
    namespace contracts {

        /** Namespace identity. */
        namespace identity {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of a UserCreated. */
                interface IUserCreated {

                    /** UserCreated user */
                    user?: (rntme.contracts.identity.v1.IUser|null);

                    /** UserCreated trigger */
                    trigger?: (string|null);

                    /** UserCreated invitation_id */
                    invitation_id?: (string|null);

                    /** UserCreated sso_connection_id */
                    sso_connection_id?: (string|null);
                }

                /** Represents a UserCreated. */
                class UserCreated implements IUserCreated {

                    /**
                     * Constructs a new UserCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IUserCreated);

                    /** UserCreated user. */
                    public user?: (rntme.contracts.identity.v1.IUser|null);

                    /** UserCreated trigger. */
                    public trigger: string;

                    /** UserCreated invitation_id. */
                    public invitation_id: string;

                    /** UserCreated sso_connection_id. */
                    public sso_connection_id: string;

                    /**
                     * Creates a new UserCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UserCreated instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IUserCreated): rntme.contracts.identity.v1.UserCreated;

                    /**
                     * Encodes the specified UserCreated message. Does not implicitly {@link rntme.contracts.identity.v1.UserCreated.verify|verify} messages.
                     * @param message UserCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IUserCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UserCreated message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.UserCreated.verify|verify} messages.
                     * @param message UserCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IUserCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a UserCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UserCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.UserCreated;

                    /**
                     * Decodes a UserCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UserCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.UserCreated;

                    /**
                     * Verifies a UserCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a UserCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UserCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.UserCreated;

                    /**
                     * Creates a plain object from a UserCreated message. Also converts values to other types if specified.
                     * @param message UserCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.UserCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UserCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UserCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a UserUpdated. */
                interface IUserUpdated {

                    /** UserUpdated user */
                    user?: (rntme.contracts.identity.v1.IUser|null);

                    /** UserUpdated changed_fields */
                    changed_fields?: (string[]|null);

                    /** UserUpdated previous */
                    previous?: (rntme.contracts.identity.v1.IUser|null);
                }

                /** Represents a UserUpdated. */
                class UserUpdated implements IUserUpdated {

                    /**
                     * Constructs a new UserUpdated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IUserUpdated);

                    /** UserUpdated user. */
                    public user?: (rntme.contracts.identity.v1.IUser|null);

                    /** UserUpdated changed_fields. */
                    public changed_fields: string[];

                    /** UserUpdated previous. */
                    public previous?: (rntme.contracts.identity.v1.IUser|null);

                    /**
                     * Creates a new UserUpdated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UserUpdated instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IUserUpdated): rntme.contracts.identity.v1.UserUpdated;

                    /**
                     * Encodes the specified UserUpdated message. Does not implicitly {@link rntme.contracts.identity.v1.UserUpdated.verify|verify} messages.
                     * @param message UserUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IUserUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UserUpdated message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.UserUpdated.verify|verify} messages.
                     * @param message UserUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IUserUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a UserUpdated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UserUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.UserUpdated;

                    /**
                     * Decodes a UserUpdated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UserUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.UserUpdated;

                    /**
                     * Verifies a UserUpdated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a UserUpdated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UserUpdated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.UserUpdated;

                    /**
                     * Creates a plain object from a UserUpdated message. Also converts values to other types if specified.
                     * @param message UserUpdated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.UserUpdated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UserUpdated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UserUpdated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a UserDeleted. */
                interface IUserDeleted {

                    /** UserDeleted canonical_id */
                    canonical_id?: (string|null);

                    /** UserDeleted vendor_id */
                    vendor_id?: (string|null);

                    /** UserDeleted hard_delete */
                    hard_delete?: (boolean|null);

                    /** UserDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a UserDeleted. */
                class UserDeleted implements IUserDeleted {

                    /**
                     * Constructs a new UserDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IUserDeleted);

                    /** UserDeleted canonical_id. */
                    public canonical_id: string;

                    /** UserDeleted vendor_id. */
                    public vendor_id: string;

                    /** UserDeleted hard_delete. */
                    public hard_delete: boolean;

                    /** UserDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new UserDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UserDeleted instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IUserDeleted): rntme.contracts.identity.v1.UserDeleted;

                    /**
                     * Encodes the specified UserDeleted message. Does not implicitly {@link rntme.contracts.identity.v1.UserDeleted.verify|verify} messages.
                     * @param message UserDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IUserDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UserDeleted message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.UserDeleted.verify|verify} messages.
                     * @param message UserDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IUserDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a UserDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UserDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.UserDeleted;

                    /**
                     * Decodes a UserDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UserDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.UserDeleted;

                    /**
                     * Verifies a UserDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a UserDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UserDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.UserDeleted;

                    /**
                     * Creates a plain object from a UserDeleted message. Also converts values to other types if specified.
                     * @param message UserDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.UserDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UserDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UserDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a UserEmailVerified. */
                interface IUserEmailVerified {

                    /** UserEmailVerified canonical_id */
                    canonical_id?: (string|null);

                    /** UserEmailVerified email */
                    email?: (string|null);

                    /** UserEmailVerified verified_at */
                    verified_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a UserEmailVerified. */
                class UserEmailVerified implements IUserEmailVerified {

                    /**
                     * Constructs a new UserEmailVerified.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IUserEmailVerified);

                    /** UserEmailVerified canonical_id. */
                    public canonical_id: string;

                    /** UserEmailVerified email. */
                    public email: string;

                    /** UserEmailVerified verified_at. */
                    public verified_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new UserEmailVerified instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UserEmailVerified instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IUserEmailVerified): rntme.contracts.identity.v1.UserEmailVerified;

                    /**
                     * Encodes the specified UserEmailVerified message. Does not implicitly {@link rntme.contracts.identity.v1.UserEmailVerified.verify|verify} messages.
                     * @param message UserEmailVerified message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IUserEmailVerified, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UserEmailVerified message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.UserEmailVerified.verify|verify} messages.
                     * @param message UserEmailVerified message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IUserEmailVerified, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a UserEmailVerified message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UserEmailVerified
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.UserEmailVerified;

                    /**
                     * Decodes a UserEmailVerified message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UserEmailVerified
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.UserEmailVerified;

                    /**
                     * Verifies a UserEmailVerified message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a UserEmailVerified message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UserEmailVerified
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.UserEmailVerified;

                    /**
                     * Creates a plain object from a UserEmailVerified message. Also converts values to other types if specified.
                     * @param message UserEmailVerified
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.UserEmailVerified, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UserEmailVerified to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UserEmailVerified
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an OrganizationCreated. */
                interface IOrganizationCreated {

                    /** OrganizationCreated organization */
                    organization?: (rntme.contracts.identity.v1.IOrganization|null);

                    /** OrganizationCreated creator_user_id */
                    creator_user_id?: (string|null);
                }

                /** Represents an OrganizationCreated. */
                class OrganizationCreated implements IOrganizationCreated {

                    /**
                     * Constructs a new OrganizationCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IOrganizationCreated);

                    /** OrganizationCreated organization. */
                    public organization?: (rntme.contracts.identity.v1.IOrganization|null);

                    /** OrganizationCreated creator_user_id. */
                    public creator_user_id: string;

                    /**
                     * Creates a new OrganizationCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns OrganizationCreated instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IOrganizationCreated): rntme.contracts.identity.v1.OrganizationCreated;

                    /**
                     * Encodes the specified OrganizationCreated message. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationCreated.verify|verify} messages.
                     * @param message OrganizationCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IOrganizationCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified OrganizationCreated message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationCreated.verify|verify} messages.
                     * @param message OrganizationCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IOrganizationCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an OrganizationCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns OrganizationCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.OrganizationCreated;

                    /**
                     * Decodes an OrganizationCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns OrganizationCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.OrganizationCreated;

                    /**
                     * Verifies an OrganizationCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an OrganizationCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns OrganizationCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.OrganizationCreated;

                    /**
                     * Creates a plain object from an OrganizationCreated message. Also converts values to other types if specified.
                     * @param message OrganizationCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.OrganizationCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this OrganizationCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for OrganizationCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an OrganizationUpdated. */
                interface IOrganizationUpdated {

                    /** OrganizationUpdated organization */
                    organization?: (rntme.contracts.identity.v1.IOrganization|null);

                    /** OrganizationUpdated changed_fields */
                    changed_fields?: (string[]|null);

                    /** OrganizationUpdated previous */
                    previous?: (rntme.contracts.identity.v1.IOrganization|null);
                }

                /** Represents an OrganizationUpdated. */
                class OrganizationUpdated implements IOrganizationUpdated {

                    /**
                     * Constructs a new OrganizationUpdated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IOrganizationUpdated);

                    /** OrganizationUpdated organization. */
                    public organization?: (rntme.contracts.identity.v1.IOrganization|null);

                    /** OrganizationUpdated changed_fields. */
                    public changed_fields: string[];

                    /** OrganizationUpdated previous. */
                    public previous?: (rntme.contracts.identity.v1.IOrganization|null);

                    /**
                     * Creates a new OrganizationUpdated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns OrganizationUpdated instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IOrganizationUpdated): rntme.contracts.identity.v1.OrganizationUpdated;

                    /**
                     * Encodes the specified OrganizationUpdated message. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationUpdated.verify|verify} messages.
                     * @param message OrganizationUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IOrganizationUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified OrganizationUpdated message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationUpdated.verify|verify} messages.
                     * @param message OrganizationUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IOrganizationUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an OrganizationUpdated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns OrganizationUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.OrganizationUpdated;

                    /**
                     * Decodes an OrganizationUpdated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns OrganizationUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.OrganizationUpdated;

                    /**
                     * Verifies an OrganizationUpdated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an OrganizationUpdated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns OrganizationUpdated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.OrganizationUpdated;

                    /**
                     * Creates a plain object from an OrganizationUpdated message. Also converts values to other types if specified.
                     * @param message OrganizationUpdated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.OrganizationUpdated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this OrganizationUpdated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for OrganizationUpdated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an OrganizationDeleted. */
                interface IOrganizationDeleted {

                    /** OrganizationDeleted canonical_id */
                    canonical_id?: (string|null);

                    /** OrganizationDeleted vendor_id */
                    vendor_id?: (string|null);

                    /** OrganizationDeleted hard_delete */
                    hard_delete?: (boolean|null);

                    /** OrganizationDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents an OrganizationDeleted. */
                class OrganizationDeleted implements IOrganizationDeleted {

                    /**
                     * Constructs a new OrganizationDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IOrganizationDeleted);

                    /** OrganizationDeleted canonical_id. */
                    public canonical_id: string;

                    /** OrganizationDeleted vendor_id. */
                    public vendor_id: string;

                    /** OrganizationDeleted hard_delete. */
                    public hard_delete: boolean;

                    /** OrganizationDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new OrganizationDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns OrganizationDeleted instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IOrganizationDeleted): rntme.contracts.identity.v1.OrganizationDeleted;

                    /**
                     * Encodes the specified OrganizationDeleted message. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationDeleted.verify|verify} messages.
                     * @param message OrganizationDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IOrganizationDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified OrganizationDeleted message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationDeleted.verify|verify} messages.
                     * @param message OrganizationDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IOrganizationDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an OrganizationDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns OrganizationDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.OrganizationDeleted;

                    /**
                     * Decodes an OrganizationDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns OrganizationDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.OrganizationDeleted;

                    /**
                     * Verifies an OrganizationDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an OrganizationDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns OrganizationDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.OrganizationDeleted;

                    /**
                     * Creates a plain object from an OrganizationDeleted message. Also converts values to other types if specified.
                     * @param message OrganizationDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.OrganizationDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this OrganizationDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for OrganizationDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MembershipCreated. */
                interface IMembershipCreated {

                    /** MembershipCreated membership */
                    membership?: (rntme.contracts.identity.v1.IOrganizationMembership|null);

                    /** MembershipCreated trigger */
                    trigger?: (string|null);

                    /** MembershipCreated invitation_id */
                    invitation_id?: (string|null);
                }

                /** Represents a MembershipCreated. */
                class MembershipCreated implements IMembershipCreated {

                    /**
                     * Constructs a new MembershipCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IMembershipCreated);

                    /** MembershipCreated membership. */
                    public membership?: (rntme.contracts.identity.v1.IOrganizationMembership|null);

                    /** MembershipCreated trigger. */
                    public trigger: string;

                    /** MembershipCreated invitation_id. */
                    public invitation_id: string;

                    /**
                     * Creates a new MembershipCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MembershipCreated instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IMembershipCreated): rntme.contracts.identity.v1.MembershipCreated;

                    /**
                     * Encodes the specified MembershipCreated message. Does not implicitly {@link rntme.contracts.identity.v1.MembershipCreated.verify|verify} messages.
                     * @param message MembershipCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IMembershipCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MembershipCreated message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.MembershipCreated.verify|verify} messages.
                     * @param message MembershipCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IMembershipCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MembershipCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MembershipCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.MembershipCreated;

                    /**
                     * Decodes a MembershipCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MembershipCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.MembershipCreated;

                    /**
                     * Verifies a MembershipCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MembershipCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MembershipCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.MembershipCreated;

                    /**
                     * Creates a plain object from a MembershipCreated message. Also converts values to other types if specified.
                     * @param message MembershipCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.MembershipCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MembershipCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MembershipCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MembershipUpdated. */
                interface IMembershipUpdated {

                    /** MembershipUpdated membership */
                    membership?: (rntme.contracts.identity.v1.IOrganizationMembership|null);

                    /** MembershipUpdated changed_fields */
                    changed_fields?: (string[]|null);

                    /** MembershipUpdated previous */
                    previous?: (rntme.contracts.identity.v1.IOrganizationMembership|null);
                }

                /** Represents a MembershipUpdated. */
                class MembershipUpdated implements IMembershipUpdated {

                    /**
                     * Constructs a new MembershipUpdated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IMembershipUpdated);

                    /** MembershipUpdated membership. */
                    public membership?: (rntme.contracts.identity.v1.IOrganizationMembership|null);

                    /** MembershipUpdated changed_fields. */
                    public changed_fields: string[];

                    /** MembershipUpdated previous. */
                    public previous?: (rntme.contracts.identity.v1.IOrganizationMembership|null);

                    /**
                     * Creates a new MembershipUpdated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MembershipUpdated instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IMembershipUpdated): rntme.contracts.identity.v1.MembershipUpdated;

                    /**
                     * Encodes the specified MembershipUpdated message. Does not implicitly {@link rntme.contracts.identity.v1.MembershipUpdated.verify|verify} messages.
                     * @param message MembershipUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IMembershipUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MembershipUpdated message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.MembershipUpdated.verify|verify} messages.
                     * @param message MembershipUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IMembershipUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MembershipUpdated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MembershipUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.MembershipUpdated;

                    /**
                     * Decodes a MembershipUpdated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MembershipUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.MembershipUpdated;

                    /**
                     * Verifies a MembershipUpdated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MembershipUpdated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MembershipUpdated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.MembershipUpdated;

                    /**
                     * Creates a plain object from a MembershipUpdated message. Also converts values to other types if specified.
                     * @param message MembershipUpdated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.MembershipUpdated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MembershipUpdated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MembershipUpdated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MembershipDeleted. */
                interface IMembershipDeleted {

                    /** MembershipDeleted canonical_id */
                    canonical_id?: (string|null);

                    /** MembershipDeleted user_id */
                    user_id?: (string|null);

                    /** MembershipDeleted organization_id */
                    organization_id?: (string|null);

                    /** MembershipDeleted reason */
                    reason?: (string|null);

                    /** MembershipDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a MembershipDeleted. */
                class MembershipDeleted implements IMembershipDeleted {

                    /**
                     * Constructs a new MembershipDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IMembershipDeleted);

                    /** MembershipDeleted canonical_id. */
                    public canonical_id: string;

                    /** MembershipDeleted user_id. */
                    public user_id: string;

                    /** MembershipDeleted organization_id. */
                    public organization_id: string;

                    /** MembershipDeleted reason. */
                    public reason: string;

                    /** MembershipDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new MembershipDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MembershipDeleted instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IMembershipDeleted): rntme.contracts.identity.v1.MembershipDeleted;

                    /**
                     * Encodes the specified MembershipDeleted message. Does not implicitly {@link rntme.contracts.identity.v1.MembershipDeleted.verify|verify} messages.
                     * @param message MembershipDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IMembershipDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MembershipDeleted message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.MembershipDeleted.verify|verify} messages.
                     * @param message MembershipDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IMembershipDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MembershipDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MembershipDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.MembershipDeleted;

                    /**
                     * Decodes a MembershipDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MembershipDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.MembershipDeleted;

                    /**
                     * Verifies a MembershipDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MembershipDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MembershipDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.MembershipDeleted;

                    /**
                     * Creates a plain object from a MembershipDeleted message. Also converts values to other types if specified.
                     * @param message MembershipDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.MembershipDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MembershipDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MembershipDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an InvitationCreated. */
                interface IInvitationCreated {

                    /** InvitationCreated invitation */
                    invitation?: (rntme.contracts.identity.v1.IInvitation|null);

                    /** InvitationCreated trigger */
                    trigger?: (string|null);
                }

                /** Represents an InvitationCreated. */
                class InvitationCreated implements IInvitationCreated {

                    /**
                     * Constructs a new InvitationCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IInvitationCreated);

                    /** InvitationCreated invitation. */
                    public invitation?: (rntme.contracts.identity.v1.IInvitation|null);

                    /** InvitationCreated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new InvitationCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns InvitationCreated instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IInvitationCreated): rntme.contracts.identity.v1.InvitationCreated;

                    /**
                     * Encodes the specified InvitationCreated message. Does not implicitly {@link rntme.contracts.identity.v1.InvitationCreated.verify|verify} messages.
                     * @param message InvitationCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IInvitationCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified InvitationCreated message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.InvitationCreated.verify|verify} messages.
                     * @param message InvitationCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IInvitationCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an InvitationCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns InvitationCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.InvitationCreated;

                    /**
                     * Decodes an InvitationCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns InvitationCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.InvitationCreated;

                    /**
                     * Verifies an InvitationCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an InvitationCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns InvitationCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.InvitationCreated;

                    /**
                     * Creates a plain object from an InvitationCreated message. Also converts values to other types if specified.
                     * @param message InvitationCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.InvitationCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this InvitationCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for InvitationCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an InvitationAccepted. */
                interface IInvitationAccepted {

                    /** InvitationAccepted invitation */
                    invitation?: (rntme.contracts.identity.v1.IInvitation|null);

                    /** InvitationAccepted accepted_by_user_id */
                    accepted_by_user_id?: (string|null);

                    /** InvitationAccepted created_membership_id */
                    created_membership_id?: (string|null);
                }

                /** Represents an InvitationAccepted. */
                class InvitationAccepted implements IInvitationAccepted {

                    /**
                     * Constructs a new InvitationAccepted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IInvitationAccepted);

                    /** InvitationAccepted invitation. */
                    public invitation?: (rntme.contracts.identity.v1.IInvitation|null);

                    /** InvitationAccepted accepted_by_user_id. */
                    public accepted_by_user_id: string;

                    /** InvitationAccepted created_membership_id. */
                    public created_membership_id: string;

                    /**
                     * Creates a new InvitationAccepted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns InvitationAccepted instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IInvitationAccepted): rntme.contracts.identity.v1.InvitationAccepted;

                    /**
                     * Encodes the specified InvitationAccepted message. Does not implicitly {@link rntme.contracts.identity.v1.InvitationAccepted.verify|verify} messages.
                     * @param message InvitationAccepted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IInvitationAccepted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified InvitationAccepted message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.InvitationAccepted.verify|verify} messages.
                     * @param message InvitationAccepted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IInvitationAccepted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an InvitationAccepted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns InvitationAccepted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.InvitationAccepted;

                    /**
                     * Decodes an InvitationAccepted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns InvitationAccepted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.InvitationAccepted;

                    /**
                     * Verifies an InvitationAccepted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an InvitationAccepted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns InvitationAccepted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.InvitationAccepted;

                    /**
                     * Creates a plain object from an InvitationAccepted message. Also converts values to other types if specified.
                     * @param message InvitationAccepted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.InvitationAccepted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this InvitationAccepted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for InvitationAccepted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an InvitationRevoked. */
                interface IInvitationRevoked {

                    /** InvitationRevoked invitation */
                    invitation?: (rntme.contracts.identity.v1.IInvitation|null);

                    /** InvitationRevoked revoked_by_user_id */
                    revoked_by_user_id?: (string|null);

                    /** InvitationRevoked revoked_at */
                    revoked_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents an InvitationRevoked. */
                class InvitationRevoked implements IInvitationRevoked {

                    /**
                     * Constructs a new InvitationRevoked.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IInvitationRevoked);

                    /** InvitationRevoked invitation. */
                    public invitation?: (rntme.contracts.identity.v1.IInvitation|null);

                    /** InvitationRevoked revoked_by_user_id. */
                    public revoked_by_user_id: string;

                    /** InvitationRevoked revoked_at. */
                    public revoked_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new InvitationRevoked instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns InvitationRevoked instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IInvitationRevoked): rntme.contracts.identity.v1.InvitationRevoked;

                    /**
                     * Encodes the specified InvitationRevoked message. Does not implicitly {@link rntme.contracts.identity.v1.InvitationRevoked.verify|verify} messages.
                     * @param message InvitationRevoked message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IInvitationRevoked, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified InvitationRevoked message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.InvitationRevoked.verify|verify} messages.
                     * @param message InvitationRevoked message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IInvitationRevoked, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an InvitationRevoked message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns InvitationRevoked
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.InvitationRevoked;

                    /**
                     * Decodes an InvitationRevoked message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns InvitationRevoked
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.InvitationRevoked;

                    /**
                     * Verifies an InvitationRevoked message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an InvitationRevoked message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns InvitationRevoked
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.InvitationRevoked;

                    /**
                     * Creates a plain object from an InvitationRevoked message. Also converts values to other types if specified.
                     * @param message InvitationRevoked
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.InvitationRevoked, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this InvitationRevoked to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for InvitationRevoked
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an InvitationExpired. */
                interface IInvitationExpired {

                    /** InvitationExpired invitation */
                    invitation?: (rntme.contracts.identity.v1.IInvitation|null);

                    /** InvitationExpired expired_at */
                    expired_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents an InvitationExpired. */
                class InvitationExpired implements IInvitationExpired {

                    /**
                     * Constructs a new InvitationExpired.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IInvitationExpired);

                    /** InvitationExpired invitation. */
                    public invitation?: (rntme.contracts.identity.v1.IInvitation|null);

                    /** InvitationExpired expired_at. */
                    public expired_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new InvitationExpired instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns InvitationExpired instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IInvitationExpired): rntme.contracts.identity.v1.InvitationExpired;

                    /**
                     * Encodes the specified InvitationExpired message. Does not implicitly {@link rntme.contracts.identity.v1.InvitationExpired.verify|verify} messages.
                     * @param message InvitationExpired message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IInvitationExpired, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified InvitationExpired message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.InvitationExpired.verify|verify} messages.
                     * @param message InvitationExpired message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IInvitationExpired, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an InvitationExpired message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns InvitationExpired
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.InvitationExpired;

                    /**
                     * Decodes an InvitationExpired message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns InvitationExpired
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.InvitationExpired;

                    /**
                     * Verifies an InvitationExpired message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an InvitationExpired message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns InvitationExpired
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.InvitationExpired;

                    /**
                     * Creates a plain object from an InvitationExpired message. Also converts values to other types if specified.
                     * @param message InvitationExpired
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.InvitationExpired, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this InvitationExpired to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for InvitationExpired
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SessionCreated. */
                interface ISessionCreated {

                    /** SessionCreated session */
                    session?: (rntme.contracts.identity.v1.ISession|null);

                    /** SessionCreated trigger */
                    trigger?: (string|null);
                }

                /** Represents a SessionCreated. */
                class SessionCreated implements ISessionCreated {

                    /**
                     * Constructs a new SessionCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.ISessionCreated);

                    /** SessionCreated session. */
                    public session?: (rntme.contracts.identity.v1.ISession|null);

                    /** SessionCreated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new SessionCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SessionCreated instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.ISessionCreated): rntme.contracts.identity.v1.SessionCreated;

                    /**
                     * Encodes the specified SessionCreated message. Does not implicitly {@link rntme.contracts.identity.v1.SessionCreated.verify|verify} messages.
                     * @param message SessionCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.ISessionCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SessionCreated message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.SessionCreated.verify|verify} messages.
                     * @param message SessionCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.ISessionCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SessionCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SessionCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.SessionCreated;

                    /**
                     * Decodes a SessionCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SessionCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.SessionCreated;

                    /**
                     * Verifies a SessionCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SessionCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SessionCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.SessionCreated;

                    /**
                     * Creates a plain object from a SessionCreated message. Also converts values to other types if specified.
                     * @param message SessionCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.SessionCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SessionCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SessionCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SessionEnded. */
                interface ISessionEnded {

                    /** SessionEnded session_id */
                    session_id?: (string|null);

                    /** SessionEnded canonical_id */
                    canonical_id?: (string|null);

                    /** SessionEnded user_id */
                    user_id?: (string|null);

                    /** SessionEnded trigger */
                    trigger?: (string|null);

                    /** SessionEnded ended_at */
                    ended_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a SessionEnded. */
                class SessionEnded implements ISessionEnded {

                    /**
                     * Constructs a new SessionEnded.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.ISessionEnded);

                    /** SessionEnded session_id. */
                    public session_id: string;

                    /** SessionEnded canonical_id. */
                    public canonical_id: string;

                    /** SessionEnded user_id. */
                    public user_id: string;

                    /** SessionEnded trigger. */
                    public trigger: string;

                    /** SessionEnded ended_at. */
                    public ended_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new SessionEnded instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SessionEnded instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.ISessionEnded): rntme.contracts.identity.v1.SessionEnded;

                    /**
                     * Encodes the specified SessionEnded message. Does not implicitly {@link rntme.contracts.identity.v1.SessionEnded.verify|verify} messages.
                     * @param message SessionEnded message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.ISessionEnded, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SessionEnded message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.SessionEnded.verify|verify} messages.
                     * @param message SessionEnded message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.ISessionEnded, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SessionEnded message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SessionEnded
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.SessionEnded;

                    /**
                     * Decodes a SessionEnded message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SessionEnded
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.SessionEnded;

                    /**
                     * Verifies a SessionEnded message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SessionEnded message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SessionEnded
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.SessionEnded;

                    /**
                     * Creates a plain object from a SessionEnded message. Also converts values to other types if specified.
                     * @param message SessionEnded
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.SessionEnded, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SessionEnded to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SessionEnded
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SessionRevoked. */
                interface ISessionRevoked {

                    /** SessionRevoked session_id */
                    session_id?: (string|null);

                    /** SessionRevoked canonical_id */
                    canonical_id?: (string|null);

                    /** SessionRevoked user_id */
                    user_id?: (string|null);

                    /** SessionRevoked revoked_by */
                    revoked_by?: (string|null);

                    /** SessionRevoked reason */
                    reason?: (string|null);

                    /** SessionRevoked revoked_at */
                    revoked_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a SessionRevoked. */
                class SessionRevoked implements ISessionRevoked {

                    /**
                     * Constructs a new SessionRevoked.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.ISessionRevoked);

                    /** SessionRevoked session_id. */
                    public session_id: string;

                    /** SessionRevoked canonical_id. */
                    public canonical_id: string;

                    /** SessionRevoked user_id. */
                    public user_id: string;

                    /** SessionRevoked revoked_by. */
                    public revoked_by: string;

                    /** SessionRevoked reason. */
                    public reason: string;

                    /** SessionRevoked revoked_at. */
                    public revoked_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new SessionRevoked instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SessionRevoked instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.ISessionRevoked): rntme.contracts.identity.v1.SessionRevoked;

                    /**
                     * Encodes the specified SessionRevoked message. Does not implicitly {@link rntme.contracts.identity.v1.SessionRevoked.verify|verify} messages.
                     * @param message SessionRevoked message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.ISessionRevoked, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SessionRevoked message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.SessionRevoked.verify|verify} messages.
                     * @param message SessionRevoked message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.ISessionRevoked, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SessionRevoked message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SessionRevoked
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.SessionRevoked;

                    /**
                     * Decodes a SessionRevoked message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SessionRevoked
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.SessionRevoked;

                    /**
                     * Verifies a SessionRevoked message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SessionRevoked message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SessionRevoked
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.SessionRevoked;

                    /**
                     * Creates a plain object from a SessionRevoked message. Also converts values to other types if specified.
                     * @param message SessionRevoked
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.SessionRevoked, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SessionRevoked to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SessionRevoked
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** UserStatus enum. */
                enum UserStatus {
                    USER_STATUS_UNSPECIFIED = 0,
                    USER_STATUS_ACTIVE = 1,
                    USER_STATUS_PENDING = 2,
                    USER_STATUS_SUSPENDED = 3,
                    USER_STATUS_DELETED = 4,
                    USER_STATUS_BLOCKED = 5,
                    USER_STATUS_VENDOR_SPECIFIC = 100
                }

                /** OrgStatus enum. */
                enum OrgStatus {
                    ORG_STATUS_UNSPECIFIED = 0,
                    ORG_STATUS_ACTIVE = 1,
                    ORG_STATUS_SUSPENDED = 2,
                    ORG_STATUS_DELETED = 3,
                    ORG_STATUS_VENDOR_SPECIFIC = 100
                }

                /** MembershipStatus enum. */
                enum MembershipStatus {
                    MEMBERSHIP_STATUS_UNSPECIFIED = 0,
                    MEMBERSHIP_STATUS_ACTIVE = 1,
                    MEMBERSHIP_STATUS_PENDING = 2,
                    MEMBERSHIP_STATUS_REVOKED = 3,
                    MEMBERSHIP_STATUS_SUSPENDED = 4,
                    MEMBERSHIP_STATUS_VENDOR_SPECIFIC = 100
                }

                /** InvitationStatus enum. */
                enum InvitationStatus {
                    INVITATION_STATUS_UNSPECIFIED = 0,
                    INVITATION_STATUS_PENDING = 1,
                    INVITATION_STATUS_ACCEPTED = 2,
                    INVITATION_STATUS_REVOKED = 3,
                    INVITATION_STATUS_EXPIRED = 4,
                    INVITATION_STATUS_VENDOR_SPECIFIC = 100
                }

                /** SessionStatus enum. */
                enum SessionStatus {
                    SESSION_STATUS_UNSPECIFIED = 0,
                    SESSION_STATUS_ACTIVE = 1,
                    SESSION_STATUS_ENDED = 2,
                    SESSION_STATUS_REVOKED = 3,
                    SESSION_STATUS_EXPIRED = 4,
                    SESSION_STATUS_VENDOR_SPECIFIC = 100
                }

                /** TokenType enum. */
                enum TokenType {
                    TOKEN_TYPE_UNSPECIFIED = 0,
                    TOKEN_TYPE_OPAQUE_SESSION = 1,
                    TOKEN_TYPE_JWT_ACCESS = 2,
                    TOKEN_TYPE_JWT_REFRESH = 3
                }

                /** ResolutionInputType enum. */
                enum ResolutionInputType {
                    RESOLUTION_INPUT_TYPE_UNSPECIFIED = 0,
                    RESOLUTION_INPUT_TYPE_EMAIL = 1,
                    RESOLUTION_INPUT_TYPE_VENDOR_ID = 2,
                    RESOLUTION_INPUT_TYPE_SSO_SUBJECT = 3,
                    RESOLUTION_INPUT_TYPE_PHONE = 4,
                    RESOLUTION_INPUT_TYPE_USERNAME = 5
                }

                /** Properties of a User. */
                interface IUser {

                    /** User ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** User email */
                    email?: (string|null);

                    /** User email_verified */
                    email_verified?: (boolean|null);

                    /** User name */
                    name?: (rntme.contracts.common.v1.IName|null);

                    /** User phone */
                    phone?: (string|null);

                    /** User phone_verified */
                    phone_verified?: (boolean|null);

                    /** User avatar_url */
                    avatar_url?: (string|null);

                    /** User status */
                    status?: (rntme.contracts.identity.v1.UserStatus|null);

                    /** User metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** User created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** User updated_at */
                    updated_at?: (google.protobuf.ITimestamp|null);

                    /** User last_sign_in_at */
                    last_sign_in_at?: (google.protobuf.ITimestamp|null);

                    /** User deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** User vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a User. */
                class User implements IUser {

                    /**
                     * Constructs a new User.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IUser);

                    /** User ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** User email. */
                    public email: string;

                    /** User email_verified. */
                    public email_verified: boolean;

                    /** User name. */
                    public name?: (rntme.contracts.common.v1.IName|null);

                    /** User phone. */
                    public phone: string;

                    /** User phone_verified. */
                    public phone_verified: boolean;

                    /** User avatar_url. */
                    public avatar_url: string;

                    /** User status. */
                    public status: rntme.contracts.identity.v1.UserStatus;

                    /** User metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** User created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** User updated_at. */
                    public updated_at?: (google.protobuf.ITimestamp|null);

                    /** User last_sign_in_at. */
                    public last_sign_in_at?: (google.protobuf.ITimestamp|null);

                    /** User deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** User vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new User instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns User instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IUser): rntme.contracts.identity.v1.User;

                    /**
                     * Encodes the specified User message. Does not implicitly {@link rntme.contracts.identity.v1.User.verify|verify} messages.
                     * @param message User message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IUser, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified User message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.User.verify|verify} messages.
                     * @param message User message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IUser, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a User message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns User
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.User;

                    /**
                     * Decodes a User message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns User
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.User;

                    /**
                     * Verifies a User message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a User message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns User
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.User;

                    /**
                     * Creates a plain object from a User message. Also converts values to other types if specified.
                     * @param message User
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.User, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this User to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for User
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an Organization. */
                interface IOrganization {

                    /** Organization ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Organization name */
                    name?: (string|null);

                    /** Organization slug */
                    slug?: (string|null);

                    /** Organization logo_url */
                    logo_url?: (string|null);

                    /** Organization description */
                    description?: (string|null);

                    /** Organization status */
                    status?: (rntme.contracts.identity.v1.OrgStatus|null);

                    /** Organization metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Organization max_members */
                    max_members?: (number|null);

                    /** Organization created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** Organization updated_at */
                    updated_at?: (google.protobuf.ITimestamp|null);

                    /** Organization deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** Organization vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents an Organization. */
                class Organization implements IOrganization {

                    /**
                     * Constructs a new Organization.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IOrganization);

                    /** Organization ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Organization name. */
                    public name: string;

                    /** Organization slug. */
                    public slug: string;

                    /** Organization logo_url. */
                    public logo_url: string;

                    /** Organization description. */
                    public description: string;

                    /** Organization status. */
                    public status: rntme.contracts.identity.v1.OrgStatus;

                    /** Organization metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Organization max_members. */
                    public max_members: number;

                    /** Organization created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** Organization updated_at. */
                    public updated_at?: (google.protobuf.ITimestamp|null);

                    /** Organization deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** Organization vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Organization instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Organization instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IOrganization): rntme.contracts.identity.v1.Organization;

                    /**
                     * Encodes the specified Organization message. Does not implicitly {@link rntme.contracts.identity.v1.Organization.verify|verify} messages.
                     * @param message Organization message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IOrganization, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Organization message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.Organization.verify|verify} messages.
                     * @param message Organization message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IOrganization, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an Organization message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Organization
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.Organization;

                    /**
                     * Decodes an Organization message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Organization
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.Organization;

                    /**
                     * Verifies an Organization message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an Organization message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Organization
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.Organization;

                    /**
                     * Creates a plain object from an Organization message. Also converts values to other types if specified.
                     * @param message Organization
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.Organization, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Organization to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Organization
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an OrganizationMembership. */
                interface IOrganizationMembership {

                    /** OrganizationMembership ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** OrganizationMembership user_id */
                    user_id?: (string|null);

                    /** OrganizationMembership organization_id */
                    organization_id?: (string|null);

                    /** OrganizationMembership roles */
                    roles?: (string[]|null);

                    /** OrganizationMembership permissions */
                    permissions?: (string[]|null);

                    /** OrganizationMembership status */
                    status?: (rntme.contracts.identity.v1.MembershipStatus|null);

                    /** OrganizationMembership metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** OrganizationMembership created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** OrganizationMembership updated_at */
                    updated_at?: (google.protobuf.ITimestamp|null);

                    /** OrganizationMembership vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents an OrganizationMembership. */
                class OrganizationMembership implements IOrganizationMembership {

                    /**
                     * Constructs a new OrganizationMembership.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IOrganizationMembership);

                    /** OrganizationMembership ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** OrganizationMembership user_id. */
                    public user_id: string;

                    /** OrganizationMembership organization_id. */
                    public organization_id: string;

                    /** OrganizationMembership roles. */
                    public roles: string[];

                    /** OrganizationMembership permissions. */
                    public permissions: string[];

                    /** OrganizationMembership status. */
                    public status: rntme.contracts.identity.v1.MembershipStatus;

                    /** OrganizationMembership metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** OrganizationMembership created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** OrganizationMembership updated_at. */
                    public updated_at?: (google.protobuf.ITimestamp|null);

                    /** OrganizationMembership vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new OrganizationMembership instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns OrganizationMembership instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IOrganizationMembership): rntme.contracts.identity.v1.OrganizationMembership;

                    /**
                     * Encodes the specified OrganizationMembership message. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationMembership.verify|verify} messages.
                     * @param message OrganizationMembership message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IOrganizationMembership, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified OrganizationMembership message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationMembership.verify|verify} messages.
                     * @param message OrganizationMembership message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IOrganizationMembership, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an OrganizationMembership message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns OrganizationMembership
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.OrganizationMembership;

                    /**
                     * Decodes an OrganizationMembership message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns OrganizationMembership
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.OrganizationMembership;

                    /**
                     * Verifies an OrganizationMembership message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an OrganizationMembership message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns OrganizationMembership
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.OrganizationMembership;

                    /**
                     * Creates a plain object from an OrganizationMembership message. Also converts values to other types if specified.
                     * @param message OrganizationMembership
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.OrganizationMembership, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this OrganizationMembership to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for OrganizationMembership
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an Invitation. */
                interface IInvitation {

                    /** Invitation ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Invitation email */
                    email?: (string|null);

                    /** Invitation organization_id */
                    organization_id?: (string|null);

                    /** Invitation inviter_user_id */
                    inviter_user_id?: (string|null);

                    /** Invitation roles */
                    roles?: (string[]|null);

                    /** Invitation metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Invitation status */
                    status?: (rntme.contracts.identity.v1.InvitationStatus|null);

                    /** Invitation expires_at */
                    expires_at?: (google.protobuf.ITimestamp|null);

                    /** Invitation accepted_at */
                    accepted_at?: (google.protobuf.ITimestamp|null);

                    /** Invitation revoked_at */
                    revoked_at?: (google.protobuf.ITimestamp|null);

                    /** Invitation created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** Invitation vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents an Invitation. */
                class Invitation implements IInvitation {

                    /**
                     * Constructs a new Invitation.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IInvitation);

                    /** Invitation ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Invitation email. */
                    public email: string;

                    /** Invitation organization_id. */
                    public organization_id: string;

                    /** Invitation inviter_user_id. */
                    public inviter_user_id: string;

                    /** Invitation roles. */
                    public roles: string[];

                    /** Invitation metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Invitation status. */
                    public status: rntme.contracts.identity.v1.InvitationStatus;

                    /** Invitation expires_at. */
                    public expires_at?: (google.protobuf.ITimestamp|null);

                    /** Invitation accepted_at. */
                    public accepted_at?: (google.protobuf.ITimestamp|null);

                    /** Invitation revoked_at. */
                    public revoked_at?: (google.protobuf.ITimestamp|null);

                    /** Invitation created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** Invitation vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Invitation instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Invitation instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IInvitation): rntme.contracts.identity.v1.Invitation;

                    /**
                     * Encodes the specified Invitation message. Does not implicitly {@link rntme.contracts.identity.v1.Invitation.verify|verify} messages.
                     * @param message Invitation message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IInvitation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Invitation message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.Invitation.verify|verify} messages.
                     * @param message Invitation message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IInvitation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an Invitation message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Invitation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.Invitation;

                    /**
                     * Decodes an Invitation message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Invitation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.Invitation;

                    /**
                     * Verifies an Invitation message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an Invitation message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Invitation
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.Invitation;

                    /**
                     * Creates a plain object from an Invitation message. Also converts values to other types if specified.
                     * @param message Invitation
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.Invitation, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Invitation to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Invitation
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Session. */
                interface ISession {

                    /** Session ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Session session_id */
                    session_id?: (string|null);

                    /** Session user_id */
                    user_id?: (string|null);

                    /** Session organization_id */
                    organization_id?: (string|null);

                    /** Session token_type */
                    token_type?: (rntme.contracts.identity.v1.TokenType|null);

                    /** Session roles */
                    roles?: (string[]|null);

                    /** Session permissions */
                    permissions?: (string[]|null);

                    /** Session verified_factors */
                    verified_factors?: (string[]|null);

                    /** Session status */
                    status?: (rntme.contracts.identity.v1.SessionStatus|null);

                    /** Session ip_address */
                    ip_address?: (string|null);

                    /** Session user_agent */
                    user_agent?: (string|null);

                    /** Session started_at */
                    started_at?: (google.protobuf.ITimestamp|null);

                    /** Session last_active_at */
                    last_active_at?: (google.protobuf.ITimestamp|null);

                    /** Session expires_at */
                    expires_at?: (google.protobuf.ITimestamp|null);

                    /** Session revoked_at */
                    revoked_at?: (google.protobuf.ITimestamp|null);

                    /** Session vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a Session. */
                class Session implements ISession {

                    /**
                     * Constructs a new Session.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.ISession);

                    /** Session ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Session session_id. */
                    public session_id: string;

                    /** Session user_id. */
                    public user_id: string;

                    /** Session organization_id. */
                    public organization_id: string;

                    /** Session token_type. */
                    public token_type: rntme.contracts.identity.v1.TokenType;

                    /** Session roles. */
                    public roles: string[];

                    /** Session permissions. */
                    public permissions: string[];

                    /** Session verified_factors. */
                    public verified_factors: string[];

                    /** Session status. */
                    public status: rntme.contracts.identity.v1.SessionStatus;

                    /** Session ip_address. */
                    public ip_address: string;

                    /** Session user_agent. */
                    public user_agent: string;

                    /** Session started_at. */
                    public started_at?: (google.protobuf.ITimestamp|null);

                    /** Session last_active_at. */
                    public last_active_at?: (google.protobuf.ITimestamp|null);

                    /** Session expires_at. */
                    public expires_at?: (google.protobuf.ITimestamp|null);

                    /** Session revoked_at. */
                    public revoked_at?: (google.protobuf.ITimestamp|null);

                    /** Session vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Session instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Session instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.ISession): rntme.contracts.identity.v1.Session;

                    /**
                     * Encodes the specified Session message. Does not implicitly {@link rntme.contracts.identity.v1.Session.verify|verify} messages.
                     * @param message Session message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.ISession, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Session message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.Session.verify|verify} messages.
                     * @param message Session message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.ISession, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Session message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Session
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.Session;

                    /**
                     * Decodes a Session message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Session
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.Session;

                    /**
                     * Verifies a Session message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Session message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Session
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.Session;

                    /**
                     * Creates a plain object from a Session message. Also converts values to other types if specified.
                     * @param message Session
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.Session, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Session to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Session
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an IdentityResolution. */
                interface IIdentityResolution {

                    /** IdentityResolution user */
                    user?: (rntme.contracts.identity.v1.IUser|null);

                    /** IdentityResolution organization */
                    organization?: (rntme.contracts.identity.v1.IOrganization|null);

                    /** IdentityResolution exists */
                    exists?: (boolean|null);

                    /** IdentityResolution canonical_id */
                    canonical_id?: (string|null);

                    /** IdentityResolution input_type */
                    input_type?: (rntme.contracts.identity.v1.ResolutionInputType|null);

                    /** IdentityResolution input_value */
                    input_value?: (string|null);

                    /** IdentityResolution resolved_at */
                    resolved_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents an IdentityResolution. */
                class IdentityResolution implements IIdentityResolution {

                    /**
                     * Constructs a new IdentityResolution.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IIdentityResolution);

                    /** IdentityResolution user. */
                    public user?: (rntme.contracts.identity.v1.IUser|null);

                    /** IdentityResolution organization. */
                    public organization?: (rntme.contracts.identity.v1.IOrganization|null);

                    /** IdentityResolution exists. */
                    public exists: boolean;

                    /** IdentityResolution canonical_id. */
                    public canonical_id: string;

                    /** IdentityResolution input_type. */
                    public input_type: rntme.contracts.identity.v1.ResolutionInputType;

                    /** IdentityResolution input_value. */
                    public input_value: string;

                    /** IdentityResolution resolved_at. */
                    public resolved_at?: (google.protobuf.ITimestamp|null);

                    /** IdentityResolution identity. */
                    public identity?: ("user"|"organization");

                    /**
                     * Creates a new IdentityResolution instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns IdentityResolution instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IIdentityResolution): rntme.contracts.identity.v1.IdentityResolution;

                    /**
                     * Encodes the specified IdentityResolution message. Does not implicitly {@link rntme.contracts.identity.v1.IdentityResolution.verify|verify} messages.
                     * @param message IdentityResolution message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IIdentityResolution, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified IdentityResolution message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.IdentityResolution.verify|verify} messages.
                     * @param message IdentityResolution message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IIdentityResolution, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an IdentityResolution message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns IdentityResolution
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.IdentityResolution;

                    /**
                     * Decodes an IdentityResolution message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns IdentityResolution
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.IdentityResolution;

                    /**
                     * Verifies an IdentityResolution message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an IdentityResolution message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns IdentityResolution
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.IdentityResolution;

                    /**
                     * Creates a plain object from an IdentityResolution message. Also converts values to other types if specified.
                     * @param message IdentityResolution
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.IdentityResolution, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this IdentityResolution to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for IdentityResolution
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetUserRequest. */
                interface IGetUserRequest {

                    /** GetUserRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetUserRequest. */
                class GetUserRequest implements IGetUserRequest {

                    /**
                     * Constructs a new GetUserRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IGetUserRequest);

                    /** GetUserRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetUserRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetUserRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IGetUserRequest): rntme.contracts.identity.v1.GetUserRequest;

                    /**
                     * Encodes the specified GetUserRequest message. Does not implicitly {@link rntme.contracts.identity.v1.GetUserRequest.verify|verify} messages.
                     * @param message GetUserRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IGetUserRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetUserRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.GetUserRequest.verify|verify} messages.
                     * @param message GetUserRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IGetUserRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetUserRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetUserRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.GetUserRequest;

                    /**
                     * Decodes a GetUserRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetUserRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.GetUserRequest;

                    /**
                     * Verifies a GetUserRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetUserRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetUserRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.GetUserRequest;

                    /**
                     * Creates a plain object from a GetUserRequest message. Also converts values to other types if specified.
                     * @param message GetUserRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.GetUserRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetUserRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetUserRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListUsersRequest. */
                interface IListUsersRequest {

                    /** ListUsersRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListUsersRequest organization_id */
                    organization_id?: (string|null);

                    /** ListUsersRequest status */
                    status?: (rntme.contracts.identity.v1.UserStatus|null);

                    /** ListUsersRequest email */
                    email?: (string|null);
                }

                /** Represents a ListUsersRequest. */
                class ListUsersRequest implements IListUsersRequest {

                    /**
                     * Constructs a new ListUsersRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IListUsersRequest);

                    /** ListUsersRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListUsersRequest organization_id. */
                    public organization_id: string;

                    /** ListUsersRequest status. */
                    public status: rntme.contracts.identity.v1.UserStatus;

                    /** ListUsersRequest email. */
                    public email: string;

                    /**
                     * Creates a new ListUsersRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListUsersRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IListUsersRequest): rntme.contracts.identity.v1.ListUsersRequest;

                    /**
                     * Encodes the specified ListUsersRequest message. Does not implicitly {@link rntme.contracts.identity.v1.ListUsersRequest.verify|verify} messages.
                     * @param message ListUsersRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IListUsersRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListUsersRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.ListUsersRequest.verify|verify} messages.
                     * @param message ListUsersRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IListUsersRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListUsersRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListUsersRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.ListUsersRequest;

                    /**
                     * Decodes a ListUsersRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListUsersRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.ListUsersRequest;

                    /**
                     * Verifies a ListUsersRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListUsersRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListUsersRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.ListUsersRequest;

                    /**
                     * Creates a plain object from a ListUsersRequest message. Also converts values to other types if specified.
                     * @param message ListUsersRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.ListUsersRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListUsersRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListUsersRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a UserList. */
                interface IUserList {

                    /** UserList items */
                    items?: (rntme.contracts.identity.v1.IUser[]|null);

                    /** UserList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents a UserList. */
                class UserList implements IUserList {

                    /**
                     * Constructs a new UserList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IUserList);

                    /** UserList items. */
                    public items: rntme.contracts.identity.v1.IUser[];

                    /** UserList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new UserList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UserList instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IUserList): rntme.contracts.identity.v1.UserList;

                    /**
                     * Encodes the specified UserList message. Does not implicitly {@link rntme.contracts.identity.v1.UserList.verify|verify} messages.
                     * @param message UserList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IUserList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UserList message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.UserList.verify|verify} messages.
                     * @param message UserList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IUserList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a UserList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UserList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.UserList;

                    /**
                     * Decodes a UserList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UserList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.UserList;

                    /**
                     * Verifies a UserList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a UserList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UserList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.UserList;

                    /**
                     * Creates a plain object from a UserList message. Also converts values to other types if specified.
                     * @param message UserList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.UserList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UserList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UserList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetOrganizationRequest. */
                interface IGetOrganizationRequest {

                    /** GetOrganizationRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetOrganizationRequest. */
                class GetOrganizationRequest implements IGetOrganizationRequest {

                    /**
                     * Constructs a new GetOrganizationRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IGetOrganizationRequest);

                    /** GetOrganizationRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetOrganizationRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetOrganizationRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IGetOrganizationRequest): rntme.contracts.identity.v1.GetOrganizationRequest;

                    /**
                     * Encodes the specified GetOrganizationRequest message. Does not implicitly {@link rntme.contracts.identity.v1.GetOrganizationRequest.verify|verify} messages.
                     * @param message GetOrganizationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IGetOrganizationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetOrganizationRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.GetOrganizationRequest.verify|verify} messages.
                     * @param message GetOrganizationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IGetOrganizationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetOrganizationRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetOrganizationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.GetOrganizationRequest;

                    /**
                     * Decodes a GetOrganizationRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetOrganizationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.GetOrganizationRequest;

                    /**
                     * Verifies a GetOrganizationRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetOrganizationRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetOrganizationRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.GetOrganizationRequest;

                    /**
                     * Creates a plain object from a GetOrganizationRequest message. Also converts values to other types if specified.
                     * @param message GetOrganizationRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.GetOrganizationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetOrganizationRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetOrganizationRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListOrganizationsRequest. */
                interface IListOrganizationsRequest {

                    /** ListOrganizationsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListOrganizationsRequest status */
                    status?: (rntme.contracts.identity.v1.OrgStatus|null);

                    /** ListOrganizationsRequest slug */
                    slug?: (string|null);
                }

                /** Represents a ListOrganizationsRequest. */
                class ListOrganizationsRequest implements IListOrganizationsRequest {

                    /**
                     * Constructs a new ListOrganizationsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IListOrganizationsRequest);

                    /** ListOrganizationsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListOrganizationsRequest status. */
                    public status: rntme.contracts.identity.v1.OrgStatus;

                    /** ListOrganizationsRequest slug. */
                    public slug: string;

                    /**
                     * Creates a new ListOrganizationsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListOrganizationsRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IListOrganizationsRequest): rntme.contracts.identity.v1.ListOrganizationsRequest;

                    /**
                     * Encodes the specified ListOrganizationsRequest message. Does not implicitly {@link rntme.contracts.identity.v1.ListOrganizationsRequest.verify|verify} messages.
                     * @param message ListOrganizationsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IListOrganizationsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListOrganizationsRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.ListOrganizationsRequest.verify|verify} messages.
                     * @param message ListOrganizationsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IListOrganizationsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListOrganizationsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListOrganizationsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.ListOrganizationsRequest;

                    /**
                     * Decodes a ListOrganizationsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListOrganizationsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.ListOrganizationsRequest;

                    /**
                     * Verifies a ListOrganizationsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListOrganizationsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListOrganizationsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.ListOrganizationsRequest;

                    /**
                     * Creates a plain object from a ListOrganizationsRequest message. Also converts values to other types if specified.
                     * @param message ListOrganizationsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.ListOrganizationsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListOrganizationsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListOrganizationsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an OrganizationList. */
                interface IOrganizationList {

                    /** OrganizationList items */
                    items?: (rntme.contracts.identity.v1.IOrganization[]|null);

                    /** OrganizationList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents an OrganizationList. */
                class OrganizationList implements IOrganizationList {

                    /**
                     * Constructs a new OrganizationList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IOrganizationList);

                    /** OrganizationList items. */
                    public items: rntme.contracts.identity.v1.IOrganization[];

                    /** OrganizationList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new OrganizationList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns OrganizationList instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IOrganizationList): rntme.contracts.identity.v1.OrganizationList;

                    /**
                     * Encodes the specified OrganizationList message. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationList.verify|verify} messages.
                     * @param message OrganizationList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IOrganizationList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified OrganizationList message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationList.verify|verify} messages.
                     * @param message OrganizationList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IOrganizationList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an OrganizationList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns OrganizationList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.OrganizationList;

                    /**
                     * Decodes an OrganizationList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns OrganizationList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.OrganizationList;

                    /**
                     * Verifies an OrganizationList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an OrganizationList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns OrganizationList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.OrganizationList;

                    /**
                     * Creates a plain object from an OrganizationList message. Also converts values to other types if specified.
                     * @param message OrganizationList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.OrganizationList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this OrganizationList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for OrganizationList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetMembershipRequest. */
                interface IGetMembershipRequest {

                    /** GetMembershipRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetMembershipRequest. */
                class GetMembershipRequest implements IGetMembershipRequest {

                    /**
                     * Constructs a new GetMembershipRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IGetMembershipRequest);

                    /** GetMembershipRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetMembershipRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetMembershipRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IGetMembershipRequest): rntme.contracts.identity.v1.GetMembershipRequest;

                    /**
                     * Encodes the specified GetMembershipRequest message. Does not implicitly {@link rntme.contracts.identity.v1.GetMembershipRequest.verify|verify} messages.
                     * @param message GetMembershipRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IGetMembershipRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetMembershipRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.GetMembershipRequest.verify|verify} messages.
                     * @param message GetMembershipRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IGetMembershipRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetMembershipRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetMembershipRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.GetMembershipRequest;

                    /**
                     * Decodes a GetMembershipRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetMembershipRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.GetMembershipRequest;

                    /**
                     * Verifies a GetMembershipRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetMembershipRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetMembershipRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.GetMembershipRequest;

                    /**
                     * Creates a plain object from a GetMembershipRequest message. Also converts values to other types if specified.
                     * @param message GetMembershipRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.GetMembershipRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetMembershipRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetMembershipRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListMembershipsRequest. */
                interface IListMembershipsRequest {

                    /** ListMembershipsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListMembershipsRequest user_id */
                    user_id?: (string|null);

                    /** ListMembershipsRequest organization_id */
                    organization_id?: (string|null);

                    /** ListMembershipsRequest status */
                    status?: (rntme.contracts.identity.v1.MembershipStatus|null);
                }

                /** Represents a ListMembershipsRequest. */
                class ListMembershipsRequest implements IListMembershipsRequest {

                    /**
                     * Constructs a new ListMembershipsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IListMembershipsRequest);

                    /** ListMembershipsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListMembershipsRequest user_id. */
                    public user_id: string;

                    /** ListMembershipsRequest organization_id. */
                    public organization_id: string;

                    /** ListMembershipsRequest status. */
                    public status: rntme.contracts.identity.v1.MembershipStatus;

                    /**
                     * Creates a new ListMembershipsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListMembershipsRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IListMembershipsRequest): rntme.contracts.identity.v1.ListMembershipsRequest;

                    /**
                     * Encodes the specified ListMembershipsRequest message. Does not implicitly {@link rntme.contracts.identity.v1.ListMembershipsRequest.verify|verify} messages.
                     * @param message ListMembershipsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IListMembershipsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListMembershipsRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.ListMembershipsRequest.verify|verify} messages.
                     * @param message ListMembershipsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IListMembershipsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListMembershipsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListMembershipsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.ListMembershipsRequest;

                    /**
                     * Decodes a ListMembershipsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListMembershipsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.ListMembershipsRequest;

                    /**
                     * Verifies a ListMembershipsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListMembershipsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListMembershipsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.ListMembershipsRequest;

                    /**
                     * Creates a plain object from a ListMembershipsRequest message. Also converts values to other types if specified.
                     * @param message ListMembershipsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.ListMembershipsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListMembershipsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListMembershipsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an OrganizationMembershipList. */
                interface IOrganizationMembershipList {

                    /** OrganizationMembershipList items */
                    items?: (rntme.contracts.identity.v1.IOrganizationMembership[]|null);

                    /** OrganizationMembershipList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents an OrganizationMembershipList. */
                class OrganizationMembershipList implements IOrganizationMembershipList {

                    /**
                     * Constructs a new OrganizationMembershipList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IOrganizationMembershipList);

                    /** OrganizationMembershipList items. */
                    public items: rntme.contracts.identity.v1.IOrganizationMembership[];

                    /** OrganizationMembershipList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new OrganizationMembershipList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns OrganizationMembershipList instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IOrganizationMembershipList): rntme.contracts.identity.v1.OrganizationMembershipList;

                    /**
                     * Encodes the specified OrganizationMembershipList message. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationMembershipList.verify|verify} messages.
                     * @param message OrganizationMembershipList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IOrganizationMembershipList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified OrganizationMembershipList message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.OrganizationMembershipList.verify|verify} messages.
                     * @param message OrganizationMembershipList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IOrganizationMembershipList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an OrganizationMembershipList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns OrganizationMembershipList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.OrganizationMembershipList;

                    /**
                     * Decodes an OrganizationMembershipList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns OrganizationMembershipList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.OrganizationMembershipList;

                    /**
                     * Verifies an OrganizationMembershipList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an OrganizationMembershipList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns OrganizationMembershipList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.OrganizationMembershipList;

                    /**
                     * Creates a plain object from an OrganizationMembershipList message. Also converts values to other types if specified.
                     * @param message OrganizationMembershipList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.OrganizationMembershipList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this OrganizationMembershipList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for OrganizationMembershipList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetInvitationRequest. */
                interface IGetInvitationRequest {

                    /** GetInvitationRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetInvitationRequest. */
                class GetInvitationRequest implements IGetInvitationRequest {

                    /**
                     * Constructs a new GetInvitationRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IGetInvitationRequest);

                    /** GetInvitationRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetInvitationRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetInvitationRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IGetInvitationRequest): rntme.contracts.identity.v1.GetInvitationRequest;

                    /**
                     * Encodes the specified GetInvitationRequest message. Does not implicitly {@link rntme.contracts.identity.v1.GetInvitationRequest.verify|verify} messages.
                     * @param message GetInvitationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IGetInvitationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetInvitationRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.GetInvitationRequest.verify|verify} messages.
                     * @param message GetInvitationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IGetInvitationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetInvitationRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetInvitationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.GetInvitationRequest;

                    /**
                     * Decodes a GetInvitationRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetInvitationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.GetInvitationRequest;

                    /**
                     * Verifies a GetInvitationRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetInvitationRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetInvitationRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.GetInvitationRequest;

                    /**
                     * Creates a plain object from a GetInvitationRequest message. Also converts values to other types if specified.
                     * @param message GetInvitationRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.GetInvitationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetInvitationRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetInvitationRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListInvitationsRequest. */
                interface IListInvitationsRequest {

                    /** ListInvitationsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListInvitationsRequest organization_id */
                    organization_id?: (string|null);

                    /** ListInvitationsRequest email */
                    email?: (string|null);

                    /** ListInvitationsRequest status */
                    status?: (rntme.contracts.identity.v1.InvitationStatus|null);
                }

                /** Represents a ListInvitationsRequest. */
                class ListInvitationsRequest implements IListInvitationsRequest {

                    /**
                     * Constructs a new ListInvitationsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IListInvitationsRequest);

                    /** ListInvitationsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListInvitationsRequest organization_id. */
                    public organization_id: string;

                    /** ListInvitationsRequest email. */
                    public email: string;

                    /** ListInvitationsRequest status. */
                    public status: rntme.contracts.identity.v1.InvitationStatus;

                    /**
                     * Creates a new ListInvitationsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListInvitationsRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IListInvitationsRequest): rntme.contracts.identity.v1.ListInvitationsRequest;

                    /**
                     * Encodes the specified ListInvitationsRequest message. Does not implicitly {@link rntme.contracts.identity.v1.ListInvitationsRequest.verify|verify} messages.
                     * @param message ListInvitationsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IListInvitationsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListInvitationsRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.ListInvitationsRequest.verify|verify} messages.
                     * @param message ListInvitationsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IListInvitationsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListInvitationsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListInvitationsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.ListInvitationsRequest;

                    /**
                     * Decodes a ListInvitationsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListInvitationsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.ListInvitationsRequest;

                    /**
                     * Verifies a ListInvitationsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListInvitationsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListInvitationsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.ListInvitationsRequest;

                    /**
                     * Creates a plain object from a ListInvitationsRequest message. Also converts values to other types if specified.
                     * @param message ListInvitationsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.ListInvitationsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListInvitationsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListInvitationsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an InvitationList. */
                interface IInvitationList {

                    /** InvitationList items */
                    items?: (rntme.contracts.identity.v1.IInvitation[]|null);

                    /** InvitationList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents an InvitationList. */
                class InvitationList implements IInvitationList {

                    /**
                     * Constructs a new InvitationList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IInvitationList);

                    /** InvitationList items. */
                    public items: rntme.contracts.identity.v1.IInvitation[];

                    /** InvitationList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new InvitationList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns InvitationList instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IInvitationList): rntme.contracts.identity.v1.InvitationList;

                    /**
                     * Encodes the specified InvitationList message. Does not implicitly {@link rntme.contracts.identity.v1.InvitationList.verify|verify} messages.
                     * @param message InvitationList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IInvitationList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified InvitationList message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.InvitationList.verify|verify} messages.
                     * @param message InvitationList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IInvitationList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an InvitationList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns InvitationList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.InvitationList;

                    /**
                     * Decodes an InvitationList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns InvitationList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.InvitationList;

                    /**
                     * Verifies an InvitationList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an InvitationList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns InvitationList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.InvitationList;

                    /**
                     * Creates a plain object from an InvitationList message. Also converts values to other types if specified.
                     * @param message InvitationList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.InvitationList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this InvitationList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for InvitationList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetSessionRequest. */
                interface IGetSessionRequest {

                    /** GetSessionRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetSessionRequest. */
                class GetSessionRequest implements IGetSessionRequest {

                    /**
                     * Constructs a new GetSessionRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IGetSessionRequest);

                    /** GetSessionRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetSessionRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetSessionRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IGetSessionRequest): rntme.contracts.identity.v1.GetSessionRequest;

                    /**
                     * Encodes the specified GetSessionRequest message. Does not implicitly {@link rntme.contracts.identity.v1.GetSessionRequest.verify|verify} messages.
                     * @param message GetSessionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IGetSessionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetSessionRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.GetSessionRequest.verify|verify} messages.
                     * @param message GetSessionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IGetSessionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetSessionRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetSessionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.GetSessionRequest;

                    /**
                     * Decodes a GetSessionRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetSessionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.GetSessionRequest;

                    /**
                     * Verifies a GetSessionRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetSessionRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetSessionRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.GetSessionRequest;

                    /**
                     * Creates a plain object from a GetSessionRequest message. Also converts values to other types if specified.
                     * @param message GetSessionRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.GetSessionRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetSessionRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetSessionRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListSessionsRequest. */
                interface IListSessionsRequest {

                    /** ListSessionsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListSessionsRequest user_id */
                    user_id?: (string|null);

                    /** ListSessionsRequest organization_id */
                    organization_id?: (string|null);

                    /** ListSessionsRequest status */
                    status?: (rntme.contracts.identity.v1.SessionStatus|null);
                }

                /** Represents a ListSessionsRequest. */
                class ListSessionsRequest implements IListSessionsRequest {

                    /**
                     * Constructs a new ListSessionsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IListSessionsRequest);

                    /** ListSessionsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListSessionsRequest user_id. */
                    public user_id: string;

                    /** ListSessionsRequest organization_id. */
                    public organization_id: string;

                    /** ListSessionsRequest status. */
                    public status: rntme.contracts.identity.v1.SessionStatus;

                    /**
                     * Creates a new ListSessionsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListSessionsRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IListSessionsRequest): rntme.contracts.identity.v1.ListSessionsRequest;

                    /**
                     * Encodes the specified ListSessionsRequest message. Does not implicitly {@link rntme.contracts.identity.v1.ListSessionsRequest.verify|verify} messages.
                     * @param message ListSessionsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IListSessionsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListSessionsRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.ListSessionsRequest.verify|verify} messages.
                     * @param message ListSessionsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IListSessionsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListSessionsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListSessionsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.ListSessionsRequest;

                    /**
                     * Decodes a ListSessionsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListSessionsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.ListSessionsRequest;

                    /**
                     * Verifies a ListSessionsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListSessionsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListSessionsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.ListSessionsRequest;

                    /**
                     * Creates a plain object from a ListSessionsRequest message. Also converts values to other types if specified.
                     * @param message ListSessionsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.ListSessionsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListSessionsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListSessionsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SessionList. */
                interface ISessionList {

                    /** SessionList items */
                    items?: (rntme.contracts.identity.v1.ISession[]|null);

                    /** SessionList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents a SessionList. */
                class SessionList implements ISessionList {

                    /**
                     * Constructs a new SessionList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.ISessionList);

                    /** SessionList items. */
                    public items: rntme.contracts.identity.v1.ISession[];

                    /** SessionList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new SessionList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SessionList instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.ISessionList): rntme.contracts.identity.v1.SessionList;

                    /**
                     * Encodes the specified SessionList message. Does not implicitly {@link rntme.contracts.identity.v1.SessionList.verify|verify} messages.
                     * @param message SessionList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.ISessionList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SessionList message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.SessionList.verify|verify} messages.
                     * @param message SessionList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.ISessionList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SessionList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SessionList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.SessionList;

                    /**
                     * Decodes a SessionList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SessionList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.SessionList;

                    /**
                     * Verifies a SessionList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SessionList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SessionList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.SessionList;

                    /**
                     * Creates a plain object from a SessionList message. Also converts values to other types if specified.
                     * @param message SessionList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.SessionList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SessionList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SessionList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ResolveIdentityRequest. */
                interface IResolveIdentityRequest {

                    /** ResolveIdentityRequest input_type */
                    input_type?: (rntme.contracts.identity.v1.ResolutionInputType|null);

                    /** ResolveIdentityRequest input_value */
                    input_value?: (string|null);

                    /** ResolveIdentityRequest organization_id */
                    organization_id?: (string|null);
                }

                /** Represents a ResolveIdentityRequest. */
                class ResolveIdentityRequest implements IResolveIdentityRequest {

                    /**
                     * Constructs a new ResolveIdentityRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IResolveIdentityRequest);

                    /** ResolveIdentityRequest input_type. */
                    public input_type: rntme.contracts.identity.v1.ResolutionInputType;

                    /** ResolveIdentityRequest input_value. */
                    public input_value: string;

                    /** ResolveIdentityRequest organization_id. */
                    public organization_id: string;

                    /**
                     * Creates a new ResolveIdentityRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ResolveIdentityRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IResolveIdentityRequest): rntme.contracts.identity.v1.ResolveIdentityRequest;

                    /**
                     * Encodes the specified ResolveIdentityRequest message. Does not implicitly {@link rntme.contracts.identity.v1.ResolveIdentityRequest.verify|verify} messages.
                     * @param message ResolveIdentityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IResolveIdentityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ResolveIdentityRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.ResolveIdentityRequest.verify|verify} messages.
                     * @param message ResolveIdentityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IResolveIdentityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ResolveIdentityRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ResolveIdentityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.ResolveIdentityRequest;

                    /**
                     * Decodes a ResolveIdentityRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ResolveIdentityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.ResolveIdentityRequest;

                    /**
                     * Verifies a ResolveIdentityRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ResolveIdentityRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ResolveIdentityRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.ResolveIdentityRequest;

                    /**
                     * Creates a plain object from a ResolveIdentityRequest message. Also converts values to other types if specified.
                     * @param message ResolveIdentityRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.ResolveIdentityRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ResolveIdentityRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ResolveIdentityRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an IntrospectSessionRequest. */
                interface IIntrospectSessionRequest {

                    /** IntrospectSessionRequest token */
                    token?: (string|null);
                }

                /** Represents an IntrospectSessionRequest. */
                class IntrospectSessionRequest implements IIntrospectSessionRequest {

                    /**
                     * Constructs a new IntrospectSessionRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IIntrospectSessionRequest);

                    /** IntrospectSessionRequest token. */
                    public token: string;

                    /**
                     * Creates a new IntrospectSessionRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns IntrospectSessionRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IIntrospectSessionRequest): rntme.contracts.identity.v1.IntrospectSessionRequest;

                    /**
                     * Encodes the specified IntrospectSessionRequest message. Does not implicitly {@link rntme.contracts.identity.v1.IntrospectSessionRequest.verify|verify} messages.
                     * @param message IntrospectSessionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IIntrospectSessionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified IntrospectSessionRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.IntrospectSessionRequest.verify|verify} messages.
                     * @param message IntrospectSessionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IIntrospectSessionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an IntrospectSessionRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns IntrospectSessionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.IntrospectSessionRequest;

                    /**
                     * Decodes an IntrospectSessionRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns IntrospectSessionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.IntrospectSessionRequest;

                    /**
                     * Verifies an IntrospectSessionRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an IntrospectSessionRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns IntrospectSessionRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.IntrospectSessionRequest;

                    /**
                     * Creates a plain object from an IntrospectSessionRequest message. Also converts values to other types if specified.
                     * @param message IntrospectSessionRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.IntrospectSessionRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this IntrospectSessionRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for IntrospectSessionRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateUserRequest. */
                interface ICreateUserRequest {

                    /** CreateUserRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateUserRequest email */
                    email?: (string|null);

                    /** CreateUserRequest name */
                    name?: (rntme.contracts.common.v1.IName|null);

                    /** CreateUserRequest phone */
                    phone?: (string|null);

                    /** CreateUserRequest avatar_url */
                    avatar_url?: (string|null);

                    /** CreateUserRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** CreateUserRequest email_verified */
                    email_verified?: (boolean|null);
                }

                /** Represents a CreateUserRequest. */
                class CreateUserRequest implements ICreateUserRequest {

                    /**
                     * Constructs a new CreateUserRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.ICreateUserRequest);

                    /** CreateUserRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateUserRequest email. */
                    public email: string;

                    /** CreateUserRequest name. */
                    public name?: (rntme.contracts.common.v1.IName|null);

                    /** CreateUserRequest phone. */
                    public phone: string;

                    /** CreateUserRequest avatar_url. */
                    public avatar_url: string;

                    /** CreateUserRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** CreateUserRequest email_verified. */
                    public email_verified: boolean;

                    /**
                     * Creates a new CreateUserRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateUserRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.ICreateUserRequest): rntme.contracts.identity.v1.CreateUserRequest;

                    /**
                     * Encodes the specified CreateUserRequest message. Does not implicitly {@link rntme.contracts.identity.v1.CreateUserRequest.verify|verify} messages.
                     * @param message CreateUserRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.ICreateUserRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateUserRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.CreateUserRequest.verify|verify} messages.
                     * @param message CreateUserRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.ICreateUserRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateUserRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateUserRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.CreateUserRequest;

                    /**
                     * Decodes a CreateUserRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateUserRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.CreateUserRequest;

                    /**
                     * Verifies a CreateUserRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateUserRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateUserRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.CreateUserRequest;

                    /**
                     * Creates a plain object from a CreateUserRequest message. Also converts values to other types if specified.
                     * @param message CreateUserRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.CreateUserRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateUserRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateUserRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateUserRequest. */
                interface IUpdateUserRequest {

                    /** UpdateUserRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateUserRequest canonical_id */
                    canonical_id?: (string|null);

                    /** UpdateUserRequest name */
                    name?: (rntme.contracts.common.v1.IName|null);

                    /** UpdateUserRequest phone */
                    phone?: (string|null);

                    /** UpdateUserRequest avatar_url */
                    avatar_url?: (string|null);

                    /** UpdateUserRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents an UpdateUserRequest. */
                class UpdateUserRequest implements IUpdateUserRequest {

                    /**
                     * Constructs a new UpdateUserRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IUpdateUserRequest);

                    /** UpdateUserRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateUserRequest canonical_id. */
                    public canonical_id: string;

                    /** UpdateUserRequest name. */
                    public name?: (rntme.contracts.common.v1.IName|null);

                    /** UpdateUserRequest phone. */
                    public phone: string;

                    /** UpdateUserRequest avatar_url. */
                    public avatar_url: string;

                    /** UpdateUserRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new UpdateUserRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UpdateUserRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IUpdateUserRequest): rntme.contracts.identity.v1.UpdateUserRequest;

                    /**
                     * Encodes the specified UpdateUserRequest message. Does not implicitly {@link rntme.contracts.identity.v1.UpdateUserRequest.verify|verify} messages.
                     * @param message UpdateUserRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IUpdateUserRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UpdateUserRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.UpdateUserRequest.verify|verify} messages.
                     * @param message UpdateUserRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IUpdateUserRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UpdateUserRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UpdateUserRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.UpdateUserRequest;

                    /**
                     * Decodes an UpdateUserRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UpdateUserRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.UpdateUserRequest;

                    /**
                     * Verifies an UpdateUserRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UpdateUserRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateUserRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.UpdateUserRequest;

                    /**
                     * Creates a plain object from an UpdateUserRequest message. Also converts values to other types if specified.
                     * @param message UpdateUserRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.UpdateUserRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateUserRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateUserRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteUserRequest. */
                interface IDeleteUserRequest {

                    /** DeleteUserRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteUserRequest canonical_id */
                    canonical_id?: (string|null);

                    /** DeleteUserRequest hard_delete */
                    hard_delete?: (boolean|null);
                }

                /** Represents a DeleteUserRequest. */
                class DeleteUserRequest implements IDeleteUserRequest {

                    /**
                     * Constructs a new DeleteUserRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IDeleteUserRequest);

                    /** DeleteUserRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteUserRequest canonical_id. */
                    public canonical_id: string;

                    /** DeleteUserRequest hard_delete. */
                    public hard_delete: boolean;

                    /**
                     * Creates a new DeleteUserRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteUserRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IDeleteUserRequest): rntme.contracts.identity.v1.DeleteUserRequest;

                    /**
                     * Encodes the specified DeleteUserRequest message. Does not implicitly {@link rntme.contracts.identity.v1.DeleteUserRequest.verify|verify} messages.
                     * @param message DeleteUserRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IDeleteUserRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteUserRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.DeleteUserRequest.verify|verify} messages.
                     * @param message DeleteUserRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IDeleteUserRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteUserRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteUserRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.DeleteUserRequest;

                    /**
                     * Decodes a DeleteUserRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteUserRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.DeleteUserRequest;

                    /**
                     * Verifies a DeleteUserRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteUserRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteUserRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.DeleteUserRequest;

                    /**
                     * Creates a plain object from a DeleteUserRequest message. Also converts values to other types if specified.
                     * @param message DeleteUserRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.DeleteUserRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteUserRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteUserRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateOrganizationRequest. */
                interface ICreateOrganizationRequest {

                    /** CreateOrganizationRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateOrganizationRequest name */
                    name?: (string|null);

                    /** CreateOrganizationRequest slug */
                    slug?: (string|null);

                    /** CreateOrganizationRequest logo_url */
                    logo_url?: (string|null);

                    /** CreateOrganizationRequest description */
                    description?: (string|null);

                    /** CreateOrganizationRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** CreateOrganizationRequest max_members */
                    max_members?: (number|null);
                }

                /** Represents a CreateOrganizationRequest. */
                class CreateOrganizationRequest implements ICreateOrganizationRequest {

                    /**
                     * Constructs a new CreateOrganizationRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.ICreateOrganizationRequest);

                    /** CreateOrganizationRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateOrganizationRequest name. */
                    public name: string;

                    /** CreateOrganizationRequest slug. */
                    public slug: string;

                    /** CreateOrganizationRequest logo_url. */
                    public logo_url: string;

                    /** CreateOrganizationRequest description. */
                    public description: string;

                    /** CreateOrganizationRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** CreateOrganizationRequest max_members. */
                    public max_members: number;

                    /**
                     * Creates a new CreateOrganizationRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateOrganizationRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.ICreateOrganizationRequest): rntme.contracts.identity.v1.CreateOrganizationRequest;

                    /**
                     * Encodes the specified CreateOrganizationRequest message. Does not implicitly {@link rntme.contracts.identity.v1.CreateOrganizationRequest.verify|verify} messages.
                     * @param message CreateOrganizationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.ICreateOrganizationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateOrganizationRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.CreateOrganizationRequest.verify|verify} messages.
                     * @param message CreateOrganizationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.ICreateOrganizationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateOrganizationRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateOrganizationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.CreateOrganizationRequest;

                    /**
                     * Decodes a CreateOrganizationRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateOrganizationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.CreateOrganizationRequest;

                    /**
                     * Verifies a CreateOrganizationRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateOrganizationRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateOrganizationRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.CreateOrganizationRequest;

                    /**
                     * Creates a plain object from a CreateOrganizationRequest message. Also converts values to other types if specified.
                     * @param message CreateOrganizationRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.CreateOrganizationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateOrganizationRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateOrganizationRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateOrganizationRequest. */
                interface IUpdateOrganizationRequest {

                    /** UpdateOrganizationRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateOrganizationRequest canonical_id */
                    canonical_id?: (string|null);

                    /** UpdateOrganizationRequest name */
                    name?: (string|null);

                    /** UpdateOrganizationRequest slug */
                    slug?: (string|null);

                    /** UpdateOrganizationRequest logo_url */
                    logo_url?: (string|null);

                    /** UpdateOrganizationRequest description */
                    description?: (string|null);

                    /** UpdateOrganizationRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** UpdateOrganizationRequest max_members */
                    max_members?: (number|null);
                }

                /** Represents an UpdateOrganizationRequest. */
                class UpdateOrganizationRequest implements IUpdateOrganizationRequest {

                    /**
                     * Constructs a new UpdateOrganizationRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IUpdateOrganizationRequest);

                    /** UpdateOrganizationRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateOrganizationRequest canonical_id. */
                    public canonical_id: string;

                    /** UpdateOrganizationRequest name. */
                    public name: string;

                    /** UpdateOrganizationRequest slug. */
                    public slug: string;

                    /** UpdateOrganizationRequest logo_url. */
                    public logo_url: string;

                    /** UpdateOrganizationRequest description. */
                    public description: string;

                    /** UpdateOrganizationRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** UpdateOrganizationRequest max_members. */
                    public max_members: number;

                    /**
                     * Creates a new UpdateOrganizationRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UpdateOrganizationRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IUpdateOrganizationRequest): rntme.contracts.identity.v1.UpdateOrganizationRequest;

                    /**
                     * Encodes the specified UpdateOrganizationRequest message. Does not implicitly {@link rntme.contracts.identity.v1.UpdateOrganizationRequest.verify|verify} messages.
                     * @param message UpdateOrganizationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IUpdateOrganizationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UpdateOrganizationRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.UpdateOrganizationRequest.verify|verify} messages.
                     * @param message UpdateOrganizationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IUpdateOrganizationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UpdateOrganizationRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UpdateOrganizationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.UpdateOrganizationRequest;

                    /**
                     * Decodes an UpdateOrganizationRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UpdateOrganizationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.UpdateOrganizationRequest;

                    /**
                     * Verifies an UpdateOrganizationRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UpdateOrganizationRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateOrganizationRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.UpdateOrganizationRequest;

                    /**
                     * Creates a plain object from an UpdateOrganizationRequest message. Also converts values to other types if specified.
                     * @param message UpdateOrganizationRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.UpdateOrganizationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateOrganizationRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateOrganizationRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteOrganizationRequest. */
                interface IDeleteOrganizationRequest {

                    /** DeleteOrganizationRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteOrganizationRequest canonical_id */
                    canonical_id?: (string|null);

                    /** DeleteOrganizationRequest hard_delete */
                    hard_delete?: (boolean|null);
                }

                /** Represents a DeleteOrganizationRequest. */
                class DeleteOrganizationRequest implements IDeleteOrganizationRequest {

                    /**
                     * Constructs a new DeleteOrganizationRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IDeleteOrganizationRequest);

                    /** DeleteOrganizationRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteOrganizationRequest canonical_id. */
                    public canonical_id: string;

                    /** DeleteOrganizationRequest hard_delete. */
                    public hard_delete: boolean;

                    /**
                     * Creates a new DeleteOrganizationRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteOrganizationRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IDeleteOrganizationRequest): rntme.contracts.identity.v1.DeleteOrganizationRequest;

                    /**
                     * Encodes the specified DeleteOrganizationRequest message. Does not implicitly {@link rntme.contracts.identity.v1.DeleteOrganizationRequest.verify|verify} messages.
                     * @param message DeleteOrganizationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IDeleteOrganizationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteOrganizationRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.DeleteOrganizationRequest.verify|verify} messages.
                     * @param message DeleteOrganizationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IDeleteOrganizationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteOrganizationRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteOrganizationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.DeleteOrganizationRequest;

                    /**
                     * Decodes a DeleteOrganizationRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteOrganizationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.DeleteOrganizationRequest;

                    /**
                     * Verifies a DeleteOrganizationRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteOrganizationRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteOrganizationRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.DeleteOrganizationRequest;

                    /**
                     * Creates a plain object from a DeleteOrganizationRequest message. Also converts values to other types if specified.
                     * @param message DeleteOrganizationRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.DeleteOrganizationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteOrganizationRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteOrganizationRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateInvitationRequest. */
                interface ICreateInvitationRequest {

                    /** CreateInvitationRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateInvitationRequest email */
                    email?: (string|null);

                    /** CreateInvitationRequest organization_id */
                    organization_id?: (string|null);

                    /** CreateInvitationRequest roles */
                    roles?: (string[]|null);

                    /** CreateInvitationRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** CreateInvitationRequest expires_at */
                    expires_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a CreateInvitationRequest. */
                class CreateInvitationRequest implements ICreateInvitationRequest {

                    /**
                     * Constructs a new CreateInvitationRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.ICreateInvitationRequest);

                    /** CreateInvitationRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateInvitationRequest email. */
                    public email: string;

                    /** CreateInvitationRequest organization_id. */
                    public organization_id: string;

                    /** CreateInvitationRequest roles. */
                    public roles: string[];

                    /** CreateInvitationRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** CreateInvitationRequest expires_at. */
                    public expires_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new CreateInvitationRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateInvitationRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.ICreateInvitationRequest): rntme.contracts.identity.v1.CreateInvitationRequest;

                    /**
                     * Encodes the specified CreateInvitationRequest message. Does not implicitly {@link rntme.contracts.identity.v1.CreateInvitationRequest.verify|verify} messages.
                     * @param message CreateInvitationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.ICreateInvitationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateInvitationRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.CreateInvitationRequest.verify|verify} messages.
                     * @param message CreateInvitationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.ICreateInvitationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateInvitationRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateInvitationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.CreateInvitationRequest;

                    /**
                     * Decodes a CreateInvitationRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateInvitationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.CreateInvitationRequest;

                    /**
                     * Verifies a CreateInvitationRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateInvitationRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateInvitationRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.CreateInvitationRequest;

                    /**
                     * Creates a plain object from a CreateInvitationRequest message. Also converts values to other types if specified.
                     * @param message CreateInvitationRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.CreateInvitationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateInvitationRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateInvitationRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a RevokeInvitationRequest. */
                interface IRevokeInvitationRequest {

                    /** RevokeInvitationRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** RevokeInvitationRequest canonical_id */
                    canonical_id?: (string|null);

                    /** RevokeInvitationRequest reason */
                    reason?: (string|null);
                }

                /** Represents a RevokeInvitationRequest. */
                class RevokeInvitationRequest implements IRevokeInvitationRequest {

                    /**
                     * Constructs a new RevokeInvitationRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IRevokeInvitationRequest);

                    /** RevokeInvitationRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** RevokeInvitationRequest canonical_id. */
                    public canonical_id: string;

                    /** RevokeInvitationRequest reason. */
                    public reason: string;

                    /**
                     * Creates a new RevokeInvitationRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns RevokeInvitationRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IRevokeInvitationRequest): rntme.contracts.identity.v1.RevokeInvitationRequest;

                    /**
                     * Encodes the specified RevokeInvitationRequest message. Does not implicitly {@link rntme.contracts.identity.v1.RevokeInvitationRequest.verify|verify} messages.
                     * @param message RevokeInvitationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IRevokeInvitationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified RevokeInvitationRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.RevokeInvitationRequest.verify|verify} messages.
                     * @param message RevokeInvitationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IRevokeInvitationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a RevokeInvitationRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns RevokeInvitationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.RevokeInvitationRequest;

                    /**
                     * Decodes a RevokeInvitationRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns RevokeInvitationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.RevokeInvitationRequest;

                    /**
                     * Verifies a RevokeInvitationRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a RevokeInvitationRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns RevokeInvitationRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.RevokeInvitationRequest;

                    /**
                     * Creates a plain object from a RevokeInvitationRequest message. Also converts values to other types if specified.
                     * @param message RevokeInvitationRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.RevokeInvitationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this RevokeInvitationRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for RevokeInvitationRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AddMembershipRequest. */
                interface IAddMembershipRequest {

                    /** AddMembershipRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** AddMembershipRequest user_id */
                    user_id?: (string|null);

                    /** AddMembershipRequest organization_id */
                    organization_id?: (string|null);

                    /** AddMembershipRequest roles */
                    roles?: (string[]|null);

                    /** AddMembershipRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents an AddMembershipRequest. */
                class AddMembershipRequest implements IAddMembershipRequest {

                    /**
                     * Constructs a new AddMembershipRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IAddMembershipRequest);

                    /** AddMembershipRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** AddMembershipRequest user_id. */
                    public user_id: string;

                    /** AddMembershipRequest organization_id. */
                    public organization_id: string;

                    /** AddMembershipRequest roles. */
                    public roles: string[];

                    /** AddMembershipRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new AddMembershipRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AddMembershipRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IAddMembershipRequest): rntme.contracts.identity.v1.AddMembershipRequest;

                    /**
                     * Encodes the specified AddMembershipRequest message. Does not implicitly {@link rntme.contracts.identity.v1.AddMembershipRequest.verify|verify} messages.
                     * @param message AddMembershipRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IAddMembershipRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AddMembershipRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.AddMembershipRequest.verify|verify} messages.
                     * @param message AddMembershipRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IAddMembershipRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AddMembershipRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AddMembershipRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.AddMembershipRequest;

                    /**
                     * Decodes an AddMembershipRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AddMembershipRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.AddMembershipRequest;

                    /**
                     * Verifies an AddMembershipRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AddMembershipRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AddMembershipRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.AddMembershipRequest;

                    /**
                     * Creates a plain object from an AddMembershipRequest message. Also converts values to other types if specified.
                     * @param message AddMembershipRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.AddMembershipRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AddMembershipRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AddMembershipRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateMembershipRequest. */
                interface IUpdateMembershipRequest {

                    /** UpdateMembershipRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateMembershipRequest canonical_id */
                    canonical_id?: (string|null);

                    /** UpdateMembershipRequest roles */
                    roles?: (string[]|null);

                    /** UpdateMembershipRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents an UpdateMembershipRequest. */
                class UpdateMembershipRequest implements IUpdateMembershipRequest {

                    /**
                     * Constructs a new UpdateMembershipRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IUpdateMembershipRequest);

                    /** UpdateMembershipRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateMembershipRequest canonical_id. */
                    public canonical_id: string;

                    /** UpdateMembershipRequest roles. */
                    public roles: string[];

                    /** UpdateMembershipRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new UpdateMembershipRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UpdateMembershipRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IUpdateMembershipRequest): rntme.contracts.identity.v1.UpdateMembershipRequest;

                    /**
                     * Encodes the specified UpdateMembershipRequest message. Does not implicitly {@link rntme.contracts.identity.v1.UpdateMembershipRequest.verify|verify} messages.
                     * @param message UpdateMembershipRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IUpdateMembershipRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UpdateMembershipRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.UpdateMembershipRequest.verify|verify} messages.
                     * @param message UpdateMembershipRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IUpdateMembershipRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UpdateMembershipRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UpdateMembershipRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.UpdateMembershipRequest;

                    /**
                     * Decodes an UpdateMembershipRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UpdateMembershipRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.UpdateMembershipRequest;

                    /**
                     * Verifies an UpdateMembershipRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UpdateMembershipRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateMembershipRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.UpdateMembershipRequest;

                    /**
                     * Creates a plain object from an UpdateMembershipRequest message. Also converts values to other types if specified.
                     * @param message UpdateMembershipRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.UpdateMembershipRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateMembershipRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateMembershipRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a RemoveMembershipRequest. */
                interface IRemoveMembershipRequest {

                    /** RemoveMembershipRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** RemoveMembershipRequest canonical_id */
                    canonical_id?: (string|null);

                    /** RemoveMembershipRequest reason */
                    reason?: (string|null);
                }

                /** Represents a RemoveMembershipRequest. */
                class RemoveMembershipRequest implements IRemoveMembershipRequest {

                    /**
                     * Constructs a new RemoveMembershipRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IRemoveMembershipRequest);

                    /** RemoveMembershipRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** RemoveMembershipRequest canonical_id. */
                    public canonical_id: string;

                    /** RemoveMembershipRequest reason. */
                    public reason: string;

                    /**
                     * Creates a new RemoveMembershipRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns RemoveMembershipRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IRemoveMembershipRequest): rntme.contracts.identity.v1.RemoveMembershipRequest;

                    /**
                     * Encodes the specified RemoveMembershipRequest message. Does not implicitly {@link rntme.contracts.identity.v1.RemoveMembershipRequest.verify|verify} messages.
                     * @param message RemoveMembershipRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IRemoveMembershipRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified RemoveMembershipRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.RemoveMembershipRequest.verify|verify} messages.
                     * @param message RemoveMembershipRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IRemoveMembershipRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a RemoveMembershipRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns RemoveMembershipRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.RemoveMembershipRequest;

                    /**
                     * Decodes a RemoveMembershipRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns RemoveMembershipRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.RemoveMembershipRequest;

                    /**
                     * Verifies a RemoveMembershipRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a RemoveMembershipRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns RemoveMembershipRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.RemoveMembershipRequest;

                    /**
                     * Creates a plain object from a RemoveMembershipRequest message. Also converts values to other types if specified.
                     * @param message RemoveMembershipRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.RemoveMembershipRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this RemoveMembershipRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for RemoveMembershipRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a RevokeSessionRequest. */
                interface IRevokeSessionRequest {

                    /** RevokeSessionRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** RevokeSessionRequest canonical_id */
                    canonical_id?: (string|null);

                    /** RevokeSessionRequest reason */
                    reason?: (string|null);
                }

                /** Represents a RevokeSessionRequest. */
                class RevokeSessionRequest implements IRevokeSessionRequest {

                    /**
                     * Constructs a new RevokeSessionRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.identity.v1.IRevokeSessionRequest);

                    /** RevokeSessionRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** RevokeSessionRequest canonical_id. */
                    public canonical_id: string;

                    /** RevokeSessionRequest reason. */
                    public reason: string;

                    /**
                     * Creates a new RevokeSessionRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns RevokeSessionRequest instance
                     */
                    public static create(properties?: rntme.contracts.identity.v1.IRevokeSessionRequest): rntme.contracts.identity.v1.RevokeSessionRequest;

                    /**
                     * Encodes the specified RevokeSessionRequest message. Does not implicitly {@link rntme.contracts.identity.v1.RevokeSessionRequest.verify|verify} messages.
                     * @param message RevokeSessionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.identity.v1.IRevokeSessionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified RevokeSessionRequest message, length delimited. Does not implicitly {@link rntme.contracts.identity.v1.RevokeSessionRequest.verify|verify} messages.
                     * @param message RevokeSessionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.identity.v1.IRevokeSessionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a RevokeSessionRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns RevokeSessionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.identity.v1.RevokeSessionRequest;

                    /**
                     * Decodes a RevokeSessionRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns RevokeSessionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.identity.v1.RevokeSessionRequest;

                    /**
                     * Verifies a RevokeSessionRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a RevokeSessionRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns RevokeSessionRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.identity.v1.RevokeSessionRequest;

                    /**
                     * Creates a plain object from a RevokeSessionRequest message. Also converts values to other types if specified.
                     * @param message RevokeSessionRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.identity.v1.RevokeSessionRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this RevokeSessionRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for RevokeSessionRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Represents an IdentityModule */
                class IdentityModule extends $protobuf.rpc.Service {

                    /**
                     * Constructs a new IdentityModule service.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     */
                    constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                    /**
                     * Creates new IdentityModule service using the specified rpc implementation.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     * @returns RPC service. Useful where requests and/or responses are streamed.
                     */
                    public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): IdentityModule;

                    /**
                     * Calls GetUser.
                     * @param request GetUserRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and User
                     */
                    public getUser(request: rntme.contracts.identity.v1.IGetUserRequest, callback: rntme.contracts.identity.v1.IdentityModule.GetUserCallback): void;

                    /**
                     * Calls GetUser.
                     * @param request GetUserRequest message or plain object
                     * @returns Promise
                     */
                    public getUser(request: rntme.contracts.identity.v1.IGetUserRequest): Promise<rntme.contracts.identity.v1.User>;

                    /**
                     * Calls ListUsers.
                     * @param request ListUsersRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and UserList
                     */
                    public listUsers(request: rntme.contracts.identity.v1.IListUsersRequest, callback: rntme.contracts.identity.v1.IdentityModule.ListUsersCallback): void;

                    /**
                     * Calls ListUsers.
                     * @param request ListUsersRequest message or plain object
                     * @returns Promise
                     */
                    public listUsers(request: rntme.contracts.identity.v1.IListUsersRequest): Promise<rntme.contracts.identity.v1.UserList>;

                    /**
                     * Calls GetOrganization.
                     * @param request GetOrganizationRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Organization
                     */
                    public getOrganization(request: rntme.contracts.identity.v1.IGetOrganizationRequest, callback: rntme.contracts.identity.v1.IdentityModule.GetOrganizationCallback): void;

                    /**
                     * Calls GetOrganization.
                     * @param request GetOrganizationRequest message or plain object
                     * @returns Promise
                     */
                    public getOrganization(request: rntme.contracts.identity.v1.IGetOrganizationRequest): Promise<rntme.contracts.identity.v1.Organization>;

                    /**
                     * Calls ListOrganizations.
                     * @param request ListOrganizationsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and OrganizationList
                     */
                    public listOrganizations(request: rntme.contracts.identity.v1.IListOrganizationsRequest, callback: rntme.contracts.identity.v1.IdentityModule.ListOrganizationsCallback): void;

                    /**
                     * Calls ListOrganizations.
                     * @param request ListOrganizationsRequest message or plain object
                     * @returns Promise
                     */
                    public listOrganizations(request: rntme.contracts.identity.v1.IListOrganizationsRequest): Promise<rntme.contracts.identity.v1.OrganizationList>;

                    /**
                     * Calls GetMembership.
                     * @param request GetMembershipRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and OrganizationMembership
                     */
                    public getMembership(request: rntme.contracts.identity.v1.IGetMembershipRequest, callback: rntme.contracts.identity.v1.IdentityModule.GetMembershipCallback): void;

                    /**
                     * Calls GetMembership.
                     * @param request GetMembershipRequest message or plain object
                     * @returns Promise
                     */
                    public getMembership(request: rntme.contracts.identity.v1.IGetMembershipRequest): Promise<rntme.contracts.identity.v1.OrganizationMembership>;

                    /**
                     * Calls ListMemberships.
                     * @param request ListMembershipsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and OrganizationMembershipList
                     */
                    public listMemberships(request: rntme.contracts.identity.v1.IListMembershipsRequest, callback: rntme.contracts.identity.v1.IdentityModule.ListMembershipsCallback): void;

                    /**
                     * Calls ListMemberships.
                     * @param request ListMembershipsRequest message or plain object
                     * @returns Promise
                     */
                    public listMemberships(request: rntme.contracts.identity.v1.IListMembershipsRequest): Promise<rntme.contracts.identity.v1.OrganizationMembershipList>;

                    /**
                     * Calls GetInvitation.
                     * @param request GetInvitationRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Invitation
                     */
                    public getInvitation(request: rntme.contracts.identity.v1.IGetInvitationRequest, callback: rntme.contracts.identity.v1.IdentityModule.GetInvitationCallback): void;

                    /**
                     * Calls GetInvitation.
                     * @param request GetInvitationRequest message or plain object
                     * @returns Promise
                     */
                    public getInvitation(request: rntme.contracts.identity.v1.IGetInvitationRequest): Promise<rntme.contracts.identity.v1.Invitation>;

                    /**
                     * Calls ListInvitations.
                     * @param request ListInvitationsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and InvitationList
                     */
                    public listInvitations(request: rntme.contracts.identity.v1.IListInvitationsRequest, callback: rntme.contracts.identity.v1.IdentityModule.ListInvitationsCallback): void;

                    /**
                     * Calls ListInvitations.
                     * @param request ListInvitationsRequest message or plain object
                     * @returns Promise
                     */
                    public listInvitations(request: rntme.contracts.identity.v1.IListInvitationsRequest): Promise<rntme.contracts.identity.v1.InvitationList>;

                    /**
                     * Calls GetSession.
                     * @param request GetSessionRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Session
                     */
                    public getSession(request: rntme.contracts.identity.v1.IGetSessionRequest, callback: rntme.contracts.identity.v1.IdentityModule.GetSessionCallback): void;

                    /**
                     * Calls GetSession.
                     * @param request GetSessionRequest message or plain object
                     * @returns Promise
                     */
                    public getSession(request: rntme.contracts.identity.v1.IGetSessionRequest): Promise<rntme.contracts.identity.v1.Session>;

                    /**
                     * Calls ListSessions.
                     * @param request ListSessionsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and SessionList
                     */
                    public listSessions(request: rntme.contracts.identity.v1.IListSessionsRequest, callback: rntme.contracts.identity.v1.IdentityModule.ListSessionsCallback): void;

                    /**
                     * Calls ListSessions.
                     * @param request ListSessionsRequest message or plain object
                     * @returns Promise
                     */
                    public listSessions(request: rntme.contracts.identity.v1.IListSessionsRequest): Promise<rntme.contracts.identity.v1.SessionList>;

                    /**
                     * Calls ResolveIdentity.
                     * @param request ResolveIdentityRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and IdentityResolution
                     */
                    public resolveIdentity(request: rntme.contracts.identity.v1.IResolveIdentityRequest, callback: rntme.contracts.identity.v1.IdentityModule.ResolveIdentityCallback): void;

                    /**
                     * Calls ResolveIdentity.
                     * @param request ResolveIdentityRequest message or plain object
                     * @returns Promise
                     */
                    public resolveIdentity(request: rntme.contracts.identity.v1.IResolveIdentityRequest): Promise<rntme.contracts.identity.v1.IdentityResolution>;

                    /**
                     * Calls IntrospectSession.
                     * @param request IntrospectSessionRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Session
                     */
                    public introspectSession(request: rntme.contracts.identity.v1.IIntrospectSessionRequest, callback: rntme.contracts.identity.v1.IdentityModule.IntrospectSessionCallback): void;

                    /**
                     * Calls IntrospectSession.
                     * @param request IntrospectSessionRequest message or plain object
                     * @returns Promise
                     */
                    public introspectSession(request: rntme.contracts.identity.v1.IIntrospectSessionRequest): Promise<rntme.contracts.identity.v1.Session>;

                    /**
                     * Calls CreateUser.
                     * @param request CreateUserRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and User
                     */
                    public createUser(request: rntme.contracts.identity.v1.ICreateUserRequest, callback: rntme.contracts.identity.v1.IdentityModule.CreateUserCallback): void;

                    /**
                     * Calls CreateUser.
                     * @param request CreateUserRequest message or plain object
                     * @returns Promise
                     */
                    public createUser(request: rntme.contracts.identity.v1.ICreateUserRequest): Promise<rntme.contracts.identity.v1.User>;

                    /**
                     * Calls UpdateUser.
                     * @param request UpdateUserRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and User
                     */
                    public updateUser(request: rntme.contracts.identity.v1.IUpdateUserRequest, callback: rntme.contracts.identity.v1.IdentityModule.UpdateUserCallback): void;

                    /**
                     * Calls UpdateUser.
                     * @param request UpdateUserRequest message or plain object
                     * @returns Promise
                     */
                    public updateUser(request: rntme.contracts.identity.v1.IUpdateUserRequest): Promise<rntme.contracts.identity.v1.User>;

                    /**
                     * Calls DeleteUser.
                     * @param request DeleteUserRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and User
                     */
                    public deleteUser(request: rntme.contracts.identity.v1.IDeleteUserRequest, callback: rntme.contracts.identity.v1.IdentityModule.DeleteUserCallback): void;

                    /**
                     * Calls DeleteUser.
                     * @param request DeleteUserRequest message or plain object
                     * @returns Promise
                     */
                    public deleteUser(request: rntme.contracts.identity.v1.IDeleteUserRequest): Promise<rntme.contracts.identity.v1.User>;

                    /**
                     * Calls CreateOrganization.
                     * @param request CreateOrganizationRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Organization
                     */
                    public createOrganization(request: rntme.contracts.identity.v1.ICreateOrganizationRequest, callback: rntme.contracts.identity.v1.IdentityModule.CreateOrganizationCallback): void;

                    /**
                     * Calls CreateOrganization.
                     * @param request CreateOrganizationRequest message or plain object
                     * @returns Promise
                     */
                    public createOrganization(request: rntme.contracts.identity.v1.ICreateOrganizationRequest): Promise<rntme.contracts.identity.v1.Organization>;

                    /**
                     * Calls UpdateOrganization.
                     * @param request UpdateOrganizationRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Organization
                     */
                    public updateOrganization(request: rntme.contracts.identity.v1.IUpdateOrganizationRequest, callback: rntme.contracts.identity.v1.IdentityModule.UpdateOrganizationCallback): void;

                    /**
                     * Calls UpdateOrganization.
                     * @param request UpdateOrganizationRequest message or plain object
                     * @returns Promise
                     */
                    public updateOrganization(request: rntme.contracts.identity.v1.IUpdateOrganizationRequest): Promise<rntme.contracts.identity.v1.Organization>;

                    /**
                     * Calls DeleteOrganization.
                     * @param request DeleteOrganizationRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Organization
                     */
                    public deleteOrganization(request: rntme.contracts.identity.v1.IDeleteOrganizationRequest, callback: rntme.contracts.identity.v1.IdentityModule.DeleteOrganizationCallback): void;

                    /**
                     * Calls DeleteOrganization.
                     * @param request DeleteOrganizationRequest message or plain object
                     * @returns Promise
                     */
                    public deleteOrganization(request: rntme.contracts.identity.v1.IDeleteOrganizationRequest): Promise<rntme.contracts.identity.v1.Organization>;

                    /**
                     * Calls CreateInvitation.
                     * @param request CreateInvitationRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Invitation
                     */
                    public createInvitation(request: rntme.contracts.identity.v1.ICreateInvitationRequest, callback: rntme.contracts.identity.v1.IdentityModule.CreateInvitationCallback): void;

                    /**
                     * Calls CreateInvitation.
                     * @param request CreateInvitationRequest message or plain object
                     * @returns Promise
                     */
                    public createInvitation(request: rntme.contracts.identity.v1.ICreateInvitationRequest): Promise<rntme.contracts.identity.v1.Invitation>;

                    /**
                     * Calls RevokeInvitation.
                     * @param request RevokeInvitationRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Invitation
                     */
                    public revokeInvitation(request: rntme.contracts.identity.v1.IRevokeInvitationRequest, callback: rntme.contracts.identity.v1.IdentityModule.RevokeInvitationCallback): void;

                    /**
                     * Calls RevokeInvitation.
                     * @param request RevokeInvitationRequest message or plain object
                     * @returns Promise
                     */
                    public revokeInvitation(request: rntme.contracts.identity.v1.IRevokeInvitationRequest): Promise<rntme.contracts.identity.v1.Invitation>;

                    /**
                     * Calls AddMembership.
                     * @param request AddMembershipRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and OrganizationMembership
                     */
                    public addMembership(request: rntme.contracts.identity.v1.IAddMembershipRequest, callback: rntme.contracts.identity.v1.IdentityModule.AddMembershipCallback): void;

                    /**
                     * Calls AddMembership.
                     * @param request AddMembershipRequest message or plain object
                     * @returns Promise
                     */
                    public addMembership(request: rntme.contracts.identity.v1.IAddMembershipRequest): Promise<rntme.contracts.identity.v1.OrganizationMembership>;

                    /**
                     * Calls UpdateMembership.
                     * @param request UpdateMembershipRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and OrganizationMembership
                     */
                    public updateMembership(request: rntme.contracts.identity.v1.IUpdateMembershipRequest, callback: rntme.contracts.identity.v1.IdentityModule.UpdateMembershipCallback): void;

                    /**
                     * Calls UpdateMembership.
                     * @param request UpdateMembershipRequest message or plain object
                     * @returns Promise
                     */
                    public updateMembership(request: rntme.contracts.identity.v1.IUpdateMembershipRequest): Promise<rntme.contracts.identity.v1.OrganizationMembership>;

                    /**
                     * Calls RemoveMembership.
                     * @param request RemoveMembershipRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and OrganizationMembership
                     */
                    public removeMembership(request: rntme.contracts.identity.v1.IRemoveMembershipRequest, callback: rntme.contracts.identity.v1.IdentityModule.RemoveMembershipCallback): void;

                    /**
                     * Calls RemoveMembership.
                     * @param request RemoveMembershipRequest message or plain object
                     * @returns Promise
                     */
                    public removeMembership(request: rntme.contracts.identity.v1.IRemoveMembershipRequest): Promise<rntme.contracts.identity.v1.OrganizationMembership>;

                    /**
                     * Calls RevokeSession.
                     * @param request RevokeSessionRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Session
                     */
                    public revokeSession(request: rntme.contracts.identity.v1.IRevokeSessionRequest, callback: rntme.contracts.identity.v1.IdentityModule.RevokeSessionCallback): void;

                    /**
                     * Calls RevokeSession.
                     * @param request RevokeSessionRequest message or plain object
                     * @returns Promise
                     */
                    public revokeSession(request: rntme.contracts.identity.v1.IRevokeSessionRequest): Promise<rntme.contracts.identity.v1.Session>;
                }

                namespace IdentityModule {

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#getUser}.
                     * @param error Error, if any
                     * @param [response] User
                     */
                    type GetUserCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.User) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#listUsers}.
                     * @param error Error, if any
                     * @param [response] UserList
                     */
                    type ListUsersCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.UserList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#getOrganization}.
                     * @param error Error, if any
                     * @param [response] Organization
                     */
                    type GetOrganizationCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Organization) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#listOrganizations}.
                     * @param error Error, if any
                     * @param [response] OrganizationList
                     */
                    type ListOrganizationsCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.OrganizationList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#getMembership}.
                     * @param error Error, if any
                     * @param [response] OrganizationMembership
                     */
                    type GetMembershipCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.OrganizationMembership) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#listMemberships}.
                     * @param error Error, if any
                     * @param [response] OrganizationMembershipList
                     */
                    type ListMembershipsCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.OrganizationMembershipList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#getInvitation}.
                     * @param error Error, if any
                     * @param [response] Invitation
                     */
                    type GetInvitationCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Invitation) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#listInvitations}.
                     * @param error Error, if any
                     * @param [response] InvitationList
                     */
                    type ListInvitationsCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.InvitationList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#getSession}.
                     * @param error Error, if any
                     * @param [response] Session
                     */
                    type GetSessionCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Session) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#listSessions}.
                     * @param error Error, if any
                     * @param [response] SessionList
                     */
                    type ListSessionsCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.SessionList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#resolveIdentity}.
                     * @param error Error, if any
                     * @param [response] IdentityResolution
                     */
                    type ResolveIdentityCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.IdentityResolution) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#introspectSession}.
                     * @param error Error, if any
                     * @param [response] Session
                     */
                    type IntrospectSessionCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Session) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#createUser}.
                     * @param error Error, if any
                     * @param [response] User
                     */
                    type CreateUserCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.User) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#updateUser}.
                     * @param error Error, if any
                     * @param [response] User
                     */
                    type UpdateUserCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.User) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#deleteUser}.
                     * @param error Error, if any
                     * @param [response] User
                     */
                    type DeleteUserCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.User) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#createOrganization}.
                     * @param error Error, if any
                     * @param [response] Organization
                     */
                    type CreateOrganizationCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Organization) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#updateOrganization}.
                     * @param error Error, if any
                     * @param [response] Organization
                     */
                    type UpdateOrganizationCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Organization) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#deleteOrganization}.
                     * @param error Error, if any
                     * @param [response] Organization
                     */
                    type DeleteOrganizationCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Organization) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#createInvitation}.
                     * @param error Error, if any
                     * @param [response] Invitation
                     */
                    type CreateInvitationCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Invitation) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#revokeInvitation}.
                     * @param error Error, if any
                     * @param [response] Invitation
                     */
                    type RevokeInvitationCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Invitation) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#addMembership}.
                     * @param error Error, if any
                     * @param [response] OrganizationMembership
                     */
                    type AddMembershipCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.OrganizationMembership) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#updateMembership}.
                     * @param error Error, if any
                     * @param [response] OrganizationMembership
                     */
                    type UpdateMembershipCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.OrganizationMembership) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#removeMembership}.
                     * @param error Error, if any
                     * @param [response] OrganizationMembership
                     */
                    type RemoveMembershipCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.OrganizationMembership) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.identity.v1.IdentityModule#revokeSession}.
                     * @param error Error, if any
                     * @param [response] Session
                     */
                    type RevokeSessionCallback = (error: (Error|null), response?: rntme.contracts.identity.v1.Session) => void;
                }
            }
        }

        /** Namespace common. */
        namespace common {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of a CanonicalRef. */
                interface ICanonicalRef {

                    /** CanonicalRef canonical_id */
                    canonical_id?: (string|null);

                    /** CanonicalRef vendor_id */
                    vendor_id?: (string|null);

                    /** CanonicalRef module_name */
                    module_name?: (string|null);

                    /** CanonicalRef module_version */
                    module_version?: (string|null);

                    /** CanonicalRef contract_version */
                    contract_version?: (string|null);
                }

                /** Represents a CanonicalRef. */
                class CanonicalRef implements ICanonicalRef {

                    /**
                     * Constructs a new CanonicalRef.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.ICanonicalRef);

                    /** CanonicalRef canonical_id. */
                    public canonical_id: string;

                    /** CanonicalRef vendor_id. */
                    public vendor_id: string;

                    /** CanonicalRef module_name. */
                    public module_name: string;

                    /** CanonicalRef module_version. */
                    public module_version: string;

                    /** CanonicalRef contract_version. */
                    public contract_version: string;

                    /**
                     * Creates a new CanonicalRef instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CanonicalRef instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.ICanonicalRef): rntme.contracts.common.v1.CanonicalRef;

                    /**
                     * Encodes the specified CanonicalRef message. Does not implicitly {@link rntme.contracts.common.v1.CanonicalRef.verify|verify} messages.
                     * @param message CanonicalRef message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.ICanonicalRef, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CanonicalRef message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.CanonicalRef.verify|verify} messages.
                     * @param message CanonicalRef message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.ICanonicalRef, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CanonicalRef message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CanonicalRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.CanonicalRef;

                    /**
                     * Decodes a CanonicalRef message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CanonicalRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.CanonicalRef;

                    /**
                     * Verifies a CanonicalRef message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CanonicalRef message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CanonicalRef
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.CanonicalRef;

                    /**
                     * Creates a plain object from a CanonicalRef message. Also converts values to other types if specified.
                     * @param message CanonicalRef
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.CanonicalRef, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CanonicalRef to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CanonicalRef
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CommandContext. */
                interface ICommandContext {

                    /** CommandContext idempotency_key */
                    idempotency_key?: (string|null);

                    /** CommandContext correlation_id */
                    correlation_id?: (string|null);

                    /** CommandContext actor_user_id */
                    actor_user_id?: (string|null);

                    /** CommandContext actor_type */
                    actor_type?: (string|null);

                    /** CommandContext tenant_id */
                    tenant_id?: (string|null);
                }

                /** Represents a CommandContext. */
                class CommandContext implements ICommandContext {

                    /**
                     * Constructs a new CommandContext.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.ICommandContext);

                    /** CommandContext idempotency_key. */
                    public idempotency_key: string;

                    /** CommandContext correlation_id. */
                    public correlation_id: string;

                    /** CommandContext actor_user_id. */
                    public actor_user_id: string;

                    /** CommandContext actor_type. */
                    public actor_type: string;

                    /** CommandContext tenant_id. */
                    public tenant_id: string;

                    /**
                     * Creates a new CommandContext instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CommandContext instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.ICommandContext): rntme.contracts.common.v1.CommandContext;

                    /**
                     * Encodes the specified CommandContext message. Does not implicitly {@link rntme.contracts.common.v1.CommandContext.verify|verify} messages.
                     * @param message CommandContext message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.ICommandContext, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CommandContext message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.CommandContext.verify|verify} messages.
                     * @param message CommandContext message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.ICommandContext, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CommandContext message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CommandContext
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.CommandContext;

                    /**
                     * Decodes a CommandContext message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CommandContext
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.CommandContext;

                    /**
                     * Verifies a CommandContext message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CommandContext message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CommandContext
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.CommandContext;

                    /**
                     * Creates a plain object from a CommandContext message. Also converts values to other types if specified.
                     * @param message CommandContext
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.CommandContext, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CommandContext to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CommandContext
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Name. */
                interface IName {

                    /** Name given */
                    given?: (string|null);

                    /** Name family */
                    family?: (string|null);

                    /** Name display */
                    display?: (string|null);
                }

                /** Represents a Name. */
                class Name implements IName {

                    /**
                     * Constructs a new Name.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IName);

                    /** Name given. */
                    public given: string;

                    /** Name family. */
                    public family: string;

                    /** Name display. */
                    public display: string;

                    /**
                     * Creates a new Name instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Name instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IName): rntme.contracts.common.v1.Name;

                    /**
                     * Encodes the specified Name message. Does not implicitly {@link rntme.contracts.common.v1.Name.verify|verify} messages.
                     * @param message Name message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IName, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Name message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Name.verify|verify} messages.
                     * @param message Name message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IName, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Name message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Name
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.Name;

                    /**
                     * Decodes a Name message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Name
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.Name;

                    /**
                     * Verifies a Name message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Name message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Name
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.Name;

                    /**
                     * Creates a plain object from a Name message. Also converts values to other types if specified.
                     * @param message Name
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.Name, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Name to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Name
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListRequest. */
                interface IListRequest {

                    /** ListRequest limit */
                    limit?: (number|null);

                    /** ListRequest cursor */
                    cursor?: (string|null);

                    /** ListRequest offset */
                    offset?: (number|null);

                    /** ListRequest filters */
                    filters?: (rntme.contracts.common.v1.IFilter[]|null);

                    /** ListRequest sorts */
                    sorts?: (rntme.contracts.common.v1.ISort[]|null);
                }

                /** Represents a ListRequest. */
                class ListRequest implements IListRequest {

                    /**
                     * Constructs a new ListRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IListRequest);

                    /** ListRequest limit. */
                    public limit: number;

                    /** ListRequest cursor. */
                    public cursor: string;

                    /** ListRequest offset. */
                    public offset: number;

                    /** ListRequest filters. */
                    public filters: rntme.contracts.common.v1.IFilter[];

                    /** ListRequest sorts. */
                    public sorts: rntme.contracts.common.v1.ISort[];

                    /**
                     * Creates a new ListRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListRequest instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IListRequest): rntme.contracts.common.v1.ListRequest;

                    /**
                     * Encodes the specified ListRequest message. Does not implicitly {@link rntme.contracts.common.v1.ListRequest.verify|verify} messages.
                     * @param message ListRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IListRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListRequest message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.ListRequest.verify|verify} messages.
                     * @param message ListRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IListRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.ListRequest;

                    /**
                     * Decodes a ListRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.ListRequest;

                    /**
                     * Verifies a ListRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.ListRequest;

                    /**
                     * Creates a plain object from a ListRequest message. Also converts values to other types if specified.
                     * @param message ListRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.ListRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Filter. */
                interface IFilter {

                    /** Filter field */
                    field?: (string|null);

                    /** Filter operator */
                    operator?: (rntme.contracts.common.v1.FilterOperator|null);

                    /** Filter value */
                    value?: (string|null);

                    /** Filter values */
                    values?: (string[]|null);
                }

                /** Represents a Filter. */
                class Filter implements IFilter {

                    /**
                     * Constructs a new Filter.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IFilter);

                    /** Filter field. */
                    public field: string;

                    /** Filter operator. */
                    public operator: rntme.contracts.common.v1.FilterOperator;

                    /** Filter value. */
                    public value: string;

                    /** Filter values. */
                    public values: string[];

                    /**
                     * Creates a new Filter instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Filter instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IFilter): rntme.contracts.common.v1.Filter;

                    /**
                     * Encodes the specified Filter message. Does not implicitly {@link rntme.contracts.common.v1.Filter.verify|verify} messages.
                     * @param message Filter message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IFilter, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Filter message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Filter.verify|verify} messages.
                     * @param message Filter message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IFilter, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Filter message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Filter
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.Filter;

                    /**
                     * Decodes a Filter message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Filter
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.Filter;

                    /**
                     * Verifies a Filter message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Filter message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Filter
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.Filter;

                    /**
                     * Creates a plain object from a Filter message. Also converts values to other types if specified.
                     * @param message Filter
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.Filter, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Filter to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Filter
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** FilterOperator enum. */
                enum FilterOperator {
                    FILTER_OPERATOR_UNSPECIFIED = 0,
                    FILTER_OPERATOR_EQ = 1,
                    FILTER_OPERATOR_NEQ = 2,
                    FILTER_OPERATOR_GT = 3,
                    FILTER_OPERATOR_GTE = 4,
                    FILTER_OPERATOR_LT = 5,
                    FILTER_OPERATOR_LTE = 6,
                    FILTER_OPERATOR_IN = 7,
                    FILTER_OPERATOR_NOT_IN = 8,
                    FILTER_OPERATOR_CONTAINS = 9,
                    FILTER_OPERATOR_PREFIX = 10,
                    FILTER_OPERATOR_SUFFIX = 11
                }

                /** Properties of a Sort. */
                interface ISort {

                    /** Sort field */
                    field?: (string|null);

                    /** Sort direction */
                    direction?: (rntme.contracts.common.v1.SortDirection|null);
                }

                /** Represents a Sort. */
                class Sort implements ISort {

                    /**
                     * Constructs a new Sort.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.ISort);

                    /** Sort field. */
                    public field: string;

                    /** Sort direction. */
                    public direction: rntme.contracts.common.v1.SortDirection;

                    /**
                     * Creates a new Sort instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Sort instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.ISort): rntme.contracts.common.v1.Sort;

                    /**
                     * Encodes the specified Sort message. Does not implicitly {@link rntme.contracts.common.v1.Sort.verify|verify} messages.
                     * @param message Sort message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.ISort, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Sort message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Sort.verify|verify} messages.
                     * @param message Sort message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.ISort, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Sort message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Sort
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.Sort;

                    /**
                     * Decodes a Sort message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Sort
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.Sort;

                    /**
                     * Verifies a Sort message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Sort message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Sort
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.Sort;

                    /**
                     * Creates a plain object from a Sort message. Also converts values to other types if specified.
                     * @param message Sort
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.Sort, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Sort to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Sort
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** SortDirection enum. */
                enum SortDirection {
                    SORT_DIRECTION_UNSPECIFIED = 0,
                    SORT_DIRECTION_ASC = 1,
                    SORT_DIRECTION_DESC = 2
                }

                /** Properties of a ListResponseMeta. */
                interface IListResponseMeta {

                    /** ListResponseMeta limit */
                    limit?: (number|null);

                    /** ListResponseMeta next_cursor */
                    next_cursor?: (string|null);

                    /** ListResponseMeta prev_cursor */
                    prev_cursor?: (string|null);

                    /** ListResponseMeta total_count */
                    total_count?: (number|null);

                    /** ListResponseMeta has_more */
                    has_more?: (boolean|null);
                }

                /** Represents a ListResponseMeta. */
                class ListResponseMeta implements IListResponseMeta {

                    /**
                     * Constructs a new ListResponseMeta.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IListResponseMeta);

                    /** ListResponseMeta limit. */
                    public limit: number;

                    /** ListResponseMeta next_cursor. */
                    public next_cursor: string;

                    /** ListResponseMeta prev_cursor. */
                    public prev_cursor: string;

                    /** ListResponseMeta total_count. */
                    public total_count: number;

                    /** ListResponseMeta has_more. */
                    public has_more: boolean;

                    /**
                     * Creates a new ListResponseMeta instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListResponseMeta instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IListResponseMeta): rntme.contracts.common.v1.ListResponseMeta;

                    /**
                     * Encodes the specified ListResponseMeta message. Does not implicitly {@link rntme.contracts.common.v1.ListResponseMeta.verify|verify} messages.
                     * @param message ListResponseMeta message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IListResponseMeta, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListResponseMeta message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.ListResponseMeta.verify|verify} messages.
                     * @param message ListResponseMeta message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IListResponseMeta, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListResponseMeta message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListResponseMeta
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.ListResponseMeta;

                    /**
                     * Decodes a ListResponseMeta message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListResponseMeta
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.ListResponseMeta;

                    /**
                     * Verifies a ListResponseMeta message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListResponseMeta message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListResponseMeta
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.ListResponseMeta;

                    /**
                     * Creates a plain object from a ListResponseMeta message. Also converts values to other types if specified.
                     * @param message ListResponseMeta
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.ListResponseMeta, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListResponseMeta to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListResponseMeta
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Metadata. */
                interface IMetadata {

                    /** Metadata public */
                    "public"?: (google.protobuf.IStruct|null);

                    /** Metadata private */
                    "private"?: (google.protobuf.IStruct|null);

                    /** Metadata unsafe */
                    unsafe?: (google.protobuf.IStruct|null);
                }

                /** Represents a Metadata. */
                class Metadata implements IMetadata {

                    /**
                     * Constructs a new Metadata.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.common.v1.IMetadata);

                    /** Metadata public. */
                    public public?: (google.protobuf.IStruct|null);

                    /** Metadata private. */
                    public private?: (google.protobuf.IStruct|null);

                    /** Metadata unsafe. */
                    public unsafe?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Metadata instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Metadata instance
                     */
                    public static create(properties?: rntme.contracts.common.v1.IMetadata): rntme.contracts.common.v1.Metadata;

                    /**
                     * Encodes the specified Metadata message. Does not implicitly {@link rntme.contracts.common.v1.Metadata.verify|verify} messages.
                     * @param message Metadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.common.v1.IMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Metadata message, length delimited. Does not implicitly {@link rntme.contracts.common.v1.Metadata.verify|verify} messages.
                     * @param message Metadata message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.common.v1.IMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Metadata message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Metadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.common.v1.Metadata;

                    /**
                     * Decodes a Metadata message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Metadata
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.common.v1.Metadata;

                    /**
                     * Verifies a Metadata message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Metadata message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Metadata
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.common.v1.Metadata;

                    /**
                     * Creates a plain object from a Metadata message. Also converts values to other types if specified.
                     * @param message Metadata
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.common.v1.Metadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Metadata to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Metadata
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }
            }
        }
    }
}

/** Namespace google. */
export namespace google {

    /** Namespace protobuf. */
    namespace protobuf {

        /** Properties of a Timestamp. */
        interface ITimestamp {

            /** Timestamp seconds */
            seconds?: (number|Long|null);

            /** Timestamp nanos */
            nanos?: (number|null);
        }

        /** Represents a Timestamp. */
        class Timestamp implements ITimestamp {

            /**
             * Constructs a new Timestamp.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.ITimestamp);

            /** Timestamp seconds. */
            public seconds: (number|Long);

            /** Timestamp nanos. */
            public nanos: number;

            /**
             * Creates a new Timestamp instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Timestamp instance
             */
            public static create(properties?: google.protobuf.ITimestamp): google.protobuf.Timestamp;

            /**
             * Encodes the specified Timestamp message. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Timestamp message, length delimited. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Timestamp message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Timestamp;

            /**
             * Decodes a Timestamp message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Timestamp;

            /**
             * Verifies a Timestamp message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Timestamp message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Timestamp
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Timestamp;

            /**
             * Creates a plain object from a Timestamp message. Also converts values to other types if specified.
             * @param message Timestamp
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Timestamp, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Timestamp to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Timestamp
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Struct. */
        interface IStruct {

            /** Struct fields */
            fields?: ({ [k: string]: google.protobuf.IValue }|null);
        }

        /** Represents a Struct. */
        class Struct implements IStruct {

            /**
             * Constructs a new Struct.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IStruct);

            /** Struct fields. */
            public fields: { [k: string]: google.protobuf.IValue };

            /**
             * Creates a new Struct instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Struct instance
             */
            public static create(properties?: google.protobuf.IStruct): google.protobuf.Struct;

            /**
             * Encodes the specified Struct message. Does not implicitly {@link google.protobuf.Struct.verify|verify} messages.
             * @param message Struct message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IStruct, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Struct message, length delimited. Does not implicitly {@link google.protobuf.Struct.verify|verify} messages.
             * @param message Struct message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IStruct, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Struct message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Struct
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Struct;

            /**
             * Decodes a Struct message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Struct
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Struct;

            /**
             * Verifies a Struct message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Struct message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Struct
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Struct;

            /**
             * Creates a plain object from a Struct message. Also converts values to other types if specified.
             * @param message Struct
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Struct, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Struct to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Struct
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Value. */
        interface IValue {

            /** Value nullValue */
            nullValue?: (google.protobuf.NullValue|null);

            /** Value numberValue */
            numberValue?: (number|null);

            /** Value stringValue */
            stringValue?: (string|null);

            /** Value boolValue */
            boolValue?: (boolean|null);

            /** Value structValue */
            structValue?: (google.protobuf.IStruct|null);

            /** Value listValue */
            listValue?: (google.protobuf.IListValue|null);
        }

        /** Represents a Value. */
        class Value implements IValue {

            /**
             * Constructs a new Value.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IValue);

            /** Value nullValue. */
            public nullValue?: (google.protobuf.NullValue|null);

            /** Value numberValue. */
            public numberValue?: (number|null);

            /** Value stringValue. */
            public stringValue?: (string|null);

            /** Value boolValue. */
            public boolValue?: (boolean|null);

            /** Value structValue. */
            public structValue?: (google.protobuf.IStruct|null);

            /** Value listValue. */
            public listValue?: (google.protobuf.IListValue|null);

            /** Value kind. */
            public kind?: ("nullValue"|"numberValue"|"stringValue"|"boolValue"|"structValue"|"listValue");

            /**
             * Creates a new Value instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Value instance
             */
            public static create(properties?: google.protobuf.IValue): google.protobuf.Value;

            /**
             * Encodes the specified Value message. Does not implicitly {@link google.protobuf.Value.verify|verify} messages.
             * @param message Value message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IValue, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Value message, length delimited. Does not implicitly {@link google.protobuf.Value.verify|verify} messages.
             * @param message Value message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IValue, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Value message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Value;

            /**
             * Decodes a Value message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Value
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Value;

            /**
             * Verifies a Value message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Value message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Value
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Value;

            /**
             * Creates a plain object from a Value message. Also converts values to other types if specified.
             * @param message Value
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Value, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Value to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Value
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** NullValue enum. */
        enum NullValue {
            NULL_VALUE = 0
        }

        /** Properties of a ListValue. */
        interface IListValue {

            /** ListValue values */
            values?: (google.protobuf.IValue[]|null);
        }

        /** Represents a ListValue. */
        class ListValue implements IListValue {

            /**
             * Constructs a new ListValue.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IListValue);

            /** ListValue values. */
            public values: google.protobuf.IValue[];

            /**
             * Creates a new ListValue instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ListValue instance
             */
            public static create(properties?: google.protobuf.IListValue): google.protobuf.ListValue;

            /**
             * Encodes the specified ListValue message. Does not implicitly {@link google.protobuf.ListValue.verify|verify} messages.
             * @param message ListValue message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IListValue, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ListValue message, length delimited. Does not implicitly {@link google.protobuf.ListValue.verify|verify} messages.
             * @param message ListValue message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IListValue, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ListValue message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ListValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.ListValue;

            /**
             * Decodes a ListValue message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ListValue
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.ListValue;

            /**
             * Verifies a ListValue message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ListValue message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ListValue
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.ListValue;

            /**
             * Creates a plain object from a ListValue message. Also converts values to other types if specified.
             * @param message ListValue
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.ListValue, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ListValue to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ListValue
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }
}
