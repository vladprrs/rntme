import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace rntme. */
export namespace rntme {

    /** Namespace contracts. */
    namespace contracts {

        /** Namespace crm. */
        namespace crm {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of a ContactCreated. */
                interface IContactCreated {

                    /** ContactCreated contact */
                    contact?: (rntme.contracts.crm.v1.IContact|null);

                    /** ContactCreated trigger */
                    trigger?: (string|null);
                }

                /** Represents a ContactCreated. */
                class ContactCreated implements IContactCreated {

                    /**
                     * Constructs a new ContactCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IContactCreated);

                    /** ContactCreated contact. */
                    public contact?: (rntme.contracts.crm.v1.IContact|null);

                    /** ContactCreated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new ContactCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ContactCreated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IContactCreated): rntme.contracts.crm.v1.ContactCreated;

                    /**
                     * Encodes the specified ContactCreated message. Does not implicitly {@link rntme.contracts.crm.v1.ContactCreated.verify|verify} messages.
                     * @param message ContactCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IContactCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ContactCreated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ContactCreated.verify|verify} messages.
                     * @param message ContactCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IContactCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ContactCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ContactCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ContactCreated;

                    /**
                     * Decodes a ContactCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ContactCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ContactCreated;

                    /**
                     * Verifies a ContactCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ContactCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ContactCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ContactCreated;

                    /**
                     * Creates a plain object from a ContactCreated message. Also converts values to other types if specified.
                     * @param message ContactCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ContactCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ContactCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ContactCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ContactUpdated. */
                interface IContactUpdated {

                    /** ContactUpdated contact */
                    contact?: (rntme.contracts.crm.v1.IContact|null);

                    /** ContactUpdated changed_fields */
                    changed_fields?: (string[]|null);

                    /** ContactUpdated previous */
                    previous?: (rntme.contracts.crm.v1.IContact|null);

                    /** ContactUpdated trigger */
                    trigger?: (string|null);
                }

                /** Represents a ContactUpdated. */
                class ContactUpdated implements IContactUpdated {

                    /**
                     * Constructs a new ContactUpdated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IContactUpdated);

                    /** ContactUpdated contact. */
                    public contact?: (rntme.contracts.crm.v1.IContact|null);

                    /** ContactUpdated changed_fields. */
                    public changed_fields: string[];

                    /** ContactUpdated previous. */
                    public previous?: (rntme.contracts.crm.v1.IContact|null);

                    /** ContactUpdated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new ContactUpdated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ContactUpdated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IContactUpdated): rntme.contracts.crm.v1.ContactUpdated;

                    /**
                     * Encodes the specified ContactUpdated message. Does not implicitly {@link rntme.contracts.crm.v1.ContactUpdated.verify|verify} messages.
                     * @param message ContactUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IContactUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ContactUpdated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ContactUpdated.verify|verify} messages.
                     * @param message ContactUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IContactUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ContactUpdated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ContactUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ContactUpdated;

                    /**
                     * Decodes a ContactUpdated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ContactUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ContactUpdated;

                    /**
                     * Verifies a ContactUpdated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ContactUpdated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ContactUpdated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ContactUpdated;

                    /**
                     * Creates a plain object from a ContactUpdated message. Also converts values to other types if specified.
                     * @param message ContactUpdated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ContactUpdated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ContactUpdated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ContactUpdated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ContactDeleted. */
                interface IContactDeleted {

                    /** ContactDeleted canonical_id */
                    canonical_id?: (string|null);

                    /** ContactDeleted vendor_id */
                    vendor_id?: (string|null);

                    /** ContactDeleted hard_delete */
                    hard_delete?: (boolean|null);

                    /** ContactDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** ContactDeleted trigger */
                    trigger?: (string|null);
                }

                /** Represents a ContactDeleted. */
                class ContactDeleted implements IContactDeleted {

                    /**
                     * Constructs a new ContactDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IContactDeleted);

                    /** ContactDeleted canonical_id. */
                    public canonical_id: string;

                    /** ContactDeleted vendor_id. */
                    public vendor_id: string;

                    /** ContactDeleted hard_delete. */
                    public hard_delete: boolean;

                    /** ContactDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** ContactDeleted trigger. */
                    public trigger: string;

                    /**
                     * Creates a new ContactDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ContactDeleted instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IContactDeleted): rntme.contracts.crm.v1.ContactDeleted;

                    /**
                     * Encodes the specified ContactDeleted message. Does not implicitly {@link rntme.contracts.crm.v1.ContactDeleted.verify|verify} messages.
                     * @param message ContactDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IContactDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ContactDeleted message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ContactDeleted.verify|verify} messages.
                     * @param message ContactDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IContactDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ContactDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ContactDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ContactDeleted;

                    /**
                     * Decodes a ContactDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ContactDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ContactDeleted;

                    /**
                     * Verifies a ContactDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ContactDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ContactDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ContactDeleted;

                    /**
                     * Creates a plain object from a ContactDeleted message. Also converts values to other types if specified.
                     * @param message ContactDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ContactDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ContactDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ContactDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CompanyCreated. */
                interface ICompanyCreated {

                    /** CompanyCreated company */
                    company?: (rntme.contracts.crm.v1.ICompany|null);

                    /** CompanyCreated trigger */
                    trigger?: (string|null);
                }

                /** Represents a CompanyCreated. */
                class CompanyCreated implements ICompanyCreated {

                    /**
                     * Constructs a new CompanyCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICompanyCreated);

                    /** CompanyCreated company. */
                    public company?: (rntme.contracts.crm.v1.ICompany|null);

                    /** CompanyCreated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new CompanyCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CompanyCreated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICompanyCreated): rntme.contracts.crm.v1.CompanyCreated;

                    /**
                     * Encodes the specified CompanyCreated message. Does not implicitly {@link rntme.contracts.crm.v1.CompanyCreated.verify|verify} messages.
                     * @param message CompanyCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICompanyCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CompanyCreated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CompanyCreated.verify|verify} messages.
                     * @param message CompanyCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICompanyCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CompanyCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CompanyCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CompanyCreated;

                    /**
                     * Decodes a CompanyCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CompanyCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CompanyCreated;

                    /**
                     * Verifies a CompanyCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CompanyCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CompanyCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CompanyCreated;

                    /**
                     * Creates a plain object from a CompanyCreated message. Also converts values to other types if specified.
                     * @param message CompanyCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CompanyCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CompanyCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CompanyCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CompanyUpdated. */
                interface ICompanyUpdated {

                    /** CompanyUpdated company */
                    company?: (rntme.contracts.crm.v1.ICompany|null);

                    /** CompanyUpdated changed_fields */
                    changed_fields?: (string[]|null);

                    /** CompanyUpdated previous */
                    previous?: (rntme.contracts.crm.v1.ICompany|null);

                    /** CompanyUpdated trigger */
                    trigger?: (string|null);
                }

                /** Represents a CompanyUpdated. */
                class CompanyUpdated implements ICompanyUpdated {

                    /**
                     * Constructs a new CompanyUpdated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICompanyUpdated);

                    /** CompanyUpdated company. */
                    public company?: (rntme.contracts.crm.v1.ICompany|null);

                    /** CompanyUpdated changed_fields. */
                    public changed_fields: string[];

                    /** CompanyUpdated previous. */
                    public previous?: (rntme.contracts.crm.v1.ICompany|null);

                    /** CompanyUpdated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new CompanyUpdated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CompanyUpdated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICompanyUpdated): rntme.contracts.crm.v1.CompanyUpdated;

                    /**
                     * Encodes the specified CompanyUpdated message. Does not implicitly {@link rntme.contracts.crm.v1.CompanyUpdated.verify|verify} messages.
                     * @param message CompanyUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICompanyUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CompanyUpdated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CompanyUpdated.verify|verify} messages.
                     * @param message CompanyUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICompanyUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CompanyUpdated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CompanyUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CompanyUpdated;

                    /**
                     * Decodes a CompanyUpdated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CompanyUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CompanyUpdated;

                    /**
                     * Verifies a CompanyUpdated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CompanyUpdated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CompanyUpdated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CompanyUpdated;

                    /**
                     * Creates a plain object from a CompanyUpdated message. Also converts values to other types if specified.
                     * @param message CompanyUpdated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CompanyUpdated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CompanyUpdated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CompanyUpdated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CompanyDeleted. */
                interface ICompanyDeleted {

                    /** CompanyDeleted canonical_id */
                    canonical_id?: (string|null);

                    /** CompanyDeleted vendor_id */
                    vendor_id?: (string|null);

                    /** CompanyDeleted hard_delete */
                    hard_delete?: (boolean|null);

                    /** CompanyDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** CompanyDeleted trigger */
                    trigger?: (string|null);
                }

                /** Represents a CompanyDeleted. */
                class CompanyDeleted implements ICompanyDeleted {

                    /**
                     * Constructs a new CompanyDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICompanyDeleted);

                    /** CompanyDeleted canonical_id. */
                    public canonical_id: string;

                    /** CompanyDeleted vendor_id. */
                    public vendor_id: string;

                    /** CompanyDeleted hard_delete. */
                    public hard_delete: boolean;

                    /** CompanyDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** CompanyDeleted trigger. */
                    public trigger: string;

                    /**
                     * Creates a new CompanyDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CompanyDeleted instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICompanyDeleted): rntme.contracts.crm.v1.CompanyDeleted;

                    /**
                     * Encodes the specified CompanyDeleted message. Does not implicitly {@link rntme.contracts.crm.v1.CompanyDeleted.verify|verify} messages.
                     * @param message CompanyDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICompanyDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CompanyDeleted message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CompanyDeleted.verify|verify} messages.
                     * @param message CompanyDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICompanyDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CompanyDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CompanyDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CompanyDeleted;

                    /**
                     * Decodes a CompanyDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CompanyDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CompanyDeleted;

                    /**
                     * Verifies a CompanyDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CompanyDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CompanyDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CompanyDeleted;

                    /**
                     * Creates a plain object from a CompanyDeleted message. Also converts values to other types if specified.
                     * @param message CompanyDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CompanyDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CompanyDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CompanyDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DealCreated. */
                interface IDealCreated {

                    /** DealCreated deal */
                    deal?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealCreated trigger */
                    trigger?: (string|null);
                }

                /** Represents a DealCreated. */
                class DealCreated implements IDealCreated {

                    /**
                     * Constructs a new DealCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDealCreated);

                    /** DealCreated deal. */
                    public deal?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealCreated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new DealCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DealCreated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDealCreated): rntme.contracts.crm.v1.DealCreated;

                    /**
                     * Encodes the specified DealCreated message. Does not implicitly {@link rntme.contracts.crm.v1.DealCreated.verify|verify} messages.
                     * @param message DealCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDealCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DealCreated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DealCreated.verify|verify} messages.
                     * @param message DealCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDealCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DealCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DealCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DealCreated;

                    /**
                     * Decodes a DealCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DealCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DealCreated;

                    /**
                     * Verifies a DealCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DealCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DealCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DealCreated;

                    /**
                     * Creates a plain object from a DealCreated message. Also converts values to other types if specified.
                     * @param message DealCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DealCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DealCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DealCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DealUpdated. */
                interface IDealUpdated {

                    /** DealUpdated deal */
                    deal?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealUpdated changed_fields */
                    changed_fields?: (string[]|null);

                    /** DealUpdated previous */
                    previous?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealUpdated trigger */
                    trigger?: (string|null);
                }

                /** Represents a DealUpdated. */
                class DealUpdated implements IDealUpdated {

                    /**
                     * Constructs a new DealUpdated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDealUpdated);

                    /** DealUpdated deal. */
                    public deal?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealUpdated changed_fields. */
                    public changed_fields: string[];

                    /** DealUpdated previous. */
                    public previous?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealUpdated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new DealUpdated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DealUpdated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDealUpdated): rntme.contracts.crm.v1.DealUpdated;

                    /**
                     * Encodes the specified DealUpdated message. Does not implicitly {@link rntme.contracts.crm.v1.DealUpdated.verify|verify} messages.
                     * @param message DealUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDealUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DealUpdated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DealUpdated.verify|verify} messages.
                     * @param message DealUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDealUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DealUpdated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DealUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DealUpdated;

                    /**
                     * Decodes a DealUpdated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DealUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DealUpdated;

                    /**
                     * Verifies a DealUpdated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DealUpdated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DealUpdated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DealUpdated;

                    /**
                     * Creates a plain object from a DealUpdated message. Also converts values to other types if specified.
                     * @param message DealUpdated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DealUpdated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DealUpdated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DealUpdated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DealStageChanged. */
                interface IDealStageChanged {

                    /** DealStageChanged deal */
                    deal?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealStageChanged from_stage_canonical_id */
                    from_stage_canonical_id?: (string|null);

                    /** DealStageChanged to_stage_canonical_id */
                    to_stage_canonical_id?: (string|null);

                    /** DealStageChanged from_pipeline_canonical_id */
                    from_pipeline_canonical_id?: (string|null);

                    /** DealStageChanged to_pipeline_canonical_id */
                    to_pipeline_canonical_id?: (string|null);

                    /** DealStageChanged actor_canonical_id */
                    actor_canonical_id?: (string|null);

                    /** DealStageChanged occurred_at */
                    occurred_at?: (google.protobuf.ITimestamp|null);

                    /** DealStageChanged trigger */
                    trigger?: (string|null);
                }

                /** Represents a DealStageChanged. */
                class DealStageChanged implements IDealStageChanged {

                    /**
                     * Constructs a new DealStageChanged.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDealStageChanged);

                    /** DealStageChanged deal. */
                    public deal?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealStageChanged from_stage_canonical_id. */
                    public from_stage_canonical_id: string;

                    /** DealStageChanged to_stage_canonical_id. */
                    public to_stage_canonical_id: string;

                    /** DealStageChanged from_pipeline_canonical_id. */
                    public from_pipeline_canonical_id: string;

                    /** DealStageChanged to_pipeline_canonical_id. */
                    public to_pipeline_canonical_id: string;

                    /** DealStageChanged actor_canonical_id. */
                    public actor_canonical_id: string;

                    /** DealStageChanged occurred_at. */
                    public occurred_at?: (google.protobuf.ITimestamp|null);

                    /** DealStageChanged trigger. */
                    public trigger: string;

                    /**
                     * Creates a new DealStageChanged instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DealStageChanged instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDealStageChanged): rntme.contracts.crm.v1.DealStageChanged;

                    /**
                     * Encodes the specified DealStageChanged message. Does not implicitly {@link rntme.contracts.crm.v1.DealStageChanged.verify|verify} messages.
                     * @param message DealStageChanged message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDealStageChanged, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DealStageChanged message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DealStageChanged.verify|verify} messages.
                     * @param message DealStageChanged message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDealStageChanged, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DealStageChanged message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DealStageChanged
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DealStageChanged;

                    /**
                     * Decodes a DealStageChanged message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DealStageChanged
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DealStageChanged;

                    /**
                     * Verifies a DealStageChanged message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DealStageChanged message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DealStageChanged
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DealStageChanged;

                    /**
                     * Creates a plain object from a DealStageChanged message. Also converts values to other types if specified.
                     * @param message DealStageChanged
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DealStageChanged, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DealStageChanged to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DealStageChanged
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DealClosed. */
                interface IDealClosed {

                    /** DealClosed deal */
                    deal?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealClosed terminal_status */
                    terminal_status?: (rntme.contracts.crm.v1.DealStatus|null);

                    /** DealClosed close_reason */
                    close_reason?: (string|null);

                    /** DealClosed closed_at */
                    closed_at?: (google.protobuf.ITimestamp|null);

                    /** DealClosed trigger */
                    trigger?: (string|null);
                }

                /** Represents a DealClosed. */
                class DealClosed implements IDealClosed {

                    /**
                     * Constructs a new DealClosed.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDealClosed);

                    /** DealClosed deal. */
                    public deal?: (rntme.contracts.crm.v1.IDeal|null);

                    /** DealClosed terminal_status. */
                    public terminal_status: rntme.contracts.crm.v1.DealStatus;

                    /** DealClosed close_reason. */
                    public close_reason: string;

                    /** DealClosed closed_at. */
                    public closed_at?: (google.protobuf.ITimestamp|null);

                    /** DealClosed trigger. */
                    public trigger: string;

                    /**
                     * Creates a new DealClosed instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DealClosed instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDealClosed): rntme.contracts.crm.v1.DealClosed;

                    /**
                     * Encodes the specified DealClosed message. Does not implicitly {@link rntme.contracts.crm.v1.DealClosed.verify|verify} messages.
                     * @param message DealClosed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDealClosed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DealClosed message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DealClosed.verify|verify} messages.
                     * @param message DealClosed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDealClosed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DealClosed message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DealClosed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DealClosed;

                    /**
                     * Decodes a DealClosed message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DealClosed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DealClosed;

                    /**
                     * Verifies a DealClosed message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DealClosed message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DealClosed
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DealClosed;

                    /**
                     * Creates a plain object from a DealClosed message. Also converts values to other types if specified.
                     * @param message DealClosed
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DealClosed, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DealClosed to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DealClosed
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ActivityCreated. */
                interface IActivityCreated {

                    /** ActivityCreated activity */
                    activity?: (rntme.contracts.crm.v1.IActivity|null);

                    /** ActivityCreated trigger */
                    trigger?: (string|null);
                }

                /** Represents an ActivityCreated. */
                class ActivityCreated implements IActivityCreated {

                    /**
                     * Constructs a new ActivityCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IActivityCreated);

                    /** ActivityCreated activity. */
                    public activity?: (rntme.contracts.crm.v1.IActivity|null);

                    /** ActivityCreated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new ActivityCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ActivityCreated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IActivityCreated): rntme.contracts.crm.v1.ActivityCreated;

                    /**
                     * Encodes the specified ActivityCreated message. Does not implicitly {@link rntme.contracts.crm.v1.ActivityCreated.verify|verify} messages.
                     * @param message ActivityCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IActivityCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ActivityCreated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ActivityCreated.verify|verify} messages.
                     * @param message ActivityCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IActivityCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an ActivityCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ActivityCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ActivityCreated;

                    /**
                     * Decodes an ActivityCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ActivityCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ActivityCreated;

                    /**
                     * Verifies an ActivityCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an ActivityCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ActivityCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ActivityCreated;

                    /**
                     * Creates a plain object from an ActivityCreated message. Also converts values to other types if specified.
                     * @param message ActivityCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ActivityCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ActivityCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ActivityCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ActivityUpdated. */
                interface IActivityUpdated {

                    /** ActivityUpdated activity */
                    activity?: (rntme.contracts.crm.v1.IActivity|null);

                    /** ActivityUpdated changed_fields */
                    changed_fields?: (string[]|null);

                    /** ActivityUpdated previous */
                    previous?: (rntme.contracts.crm.v1.IActivity|null);

                    /** ActivityUpdated trigger */
                    trigger?: (string|null);
                }

                /** Represents an ActivityUpdated. */
                class ActivityUpdated implements IActivityUpdated {

                    /**
                     * Constructs a new ActivityUpdated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IActivityUpdated);

                    /** ActivityUpdated activity. */
                    public activity?: (rntme.contracts.crm.v1.IActivity|null);

                    /** ActivityUpdated changed_fields. */
                    public changed_fields: string[];

                    /** ActivityUpdated previous. */
                    public previous?: (rntme.contracts.crm.v1.IActivity|null);

                    /** ActivityUpdated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new ActivityUpdated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ActivityUpdated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IActivityUpdated): rntme.contracts.crm.v1.ActivityUpdated;

                    /**
                     * Encodes the specified ActivityUpdated message. Does not implicitly {@link rntme.contracts.crm.v1.ActivityUpdated.verify|verify} messages.
                     * @param message ActivityUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IActivityUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ActivityUpdated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ActivityUpdated.verify|verify} messages.
                     * @param message ActivityUpdated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IActivityUpdated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an ActivityUpdated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ActivityUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ActivityUpdated;

                    /**
                     * Decodes an ActivityUpdated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ActivityUpdated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ActivityUpdated;

                    /**
                     * Verifies an ActivityUpdated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an ActivityUpdated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ActivityUpdated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ActivityUpdated;

                    /**
                     * Creates a plain object from an ActivityUpdated message. Also converts values to other types if specified.
                     * @param message ActivityUpdated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ActivityUpdated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ActivityUpdated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ActivityUpdated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ActivityDeleted. */
                interface IActivityDeleted {

                    /** ActivityDeleted canonical_id */
                    canonical_id?: (string|null);

                    /** ActivityDeleted vendor_id */
                    vendor_id?: (string|null);

                    /** ActivityDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** ActivityDeleted trigger */
                    trigger?: (string|null);
                }

                /** Represents an ActivityDeleted. */
                class ActivityDeleted implements IActivityDeleted {

                    /**
                     * Constructs a new ActivityDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IActivityDeleted);

                    /** ActivityDeleted canonical_id. */
                    public canonical_id: string;

                    /** ActivityDeleted vendor_id. */
                    public vendor_id: string;

                    /** ActivityDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** ActivityDeleted trigger. */
                    public trigger: string;

                    /**
                     * Creates a new ActivityDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ActivityDeleted instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IActivityDeleted): rntme.contracts.crm.v1.ActivityDeleted;

                    /**
                     * Encodes the specified ActivityDeleted message. Does not implicitly {@link rntme.contracts.crm.v1.ActivityDeleted.verify|verify} messages.
                     * @param message ActivityDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IActivityDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ActivityDeleted message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ActivityDeleted.verify|verify} messages.
                     * @param message ActivityDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IActivityDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an ActivityDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ActivityDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ActivityDeleted;

                    /**
                     * Decodes an ActivityDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ActivityDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ActivityDeleted;

                    /**
                     * Verifies an ActivityDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an ActivityDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ActivityDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ActivityDeleted;

                    /**
                     * Creates a plain object from an ActivityDeleted message. Also converts values to other types if specified.
                     * @param message ActivityDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ActivityDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ActivityDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ActivityDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a NoteCreated. */
                interface INoteCreated {

                    /** NoteCreated note */
                    note?: (rntme.contracts.crm.v1.INote|null);

                    /** NoteCreated trigger */
                    trigger?: (string|null);
                }

                /** Represents a NoteCreated. */
                class NoteCreated implements INoteCreated {

                    /**
                     * Constructs a new NoteCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.INoteCreated);

                    /** NoteCreated note. */
                    public note?: (rntme.contracts.crm.v1.INote|null);

                    /** NoteCreated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new NoteCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns NoteCreated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.INoteCreated): rntme.contracts.crm.v1.NoteCreated;

                    /**
                     * Encodes the specified NoteCreated message. Does not implicitly {@link rntme.contracts.crm.v1.NoteCreated.verify|verify} messages.
                     * @param message NoteCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.INoteCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified NoteCreated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.NoteCreated.verify|verify} messages.
                     * @param message NoteCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.INoteCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a NoteCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns NoteCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.NoteCreated;

                    /**
                     * Decodes a NoteCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns NoteCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.NoteCreated;

                    /**
                     * Verifies a NoteCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a NoteCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns NoteCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.NoteCreated;

                    /**
                     * Creates a plain object from a NoteCreated message. Also converts values to other types if specified.
                     * @param message NoteCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.NoteCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this NoteCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for NoteCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a NoteDeleted. */
                interface INoteDeleted {

                    /** NoteDeleted canonical_id */
                    canonical_id?: (string|null);

                    /** NoteDeleted vendor_id */
                    vendor_id?: (string|null);

                    /** NoteDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** NoteDeleted trigger */
                    trigger?: (string|null);
                }

                /** Represents a NoteDeleted. */
                class NoteDeleted implements INoteDeleted {

                    /**
                     * Constructs a new NoteDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.INoteDeleted);

                    /** NoteDeleted canonical_id. */
                    public canonical_id: string;

                    /** NoteDeleted vendor_id. */
                    public vendor_id: string;

                    /** NoteDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** NoteDeleted trigger. */
                    public trigger: string;

                    /**
                     * Creates a new NoteDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns NoteDeleted instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.INoteDeleted): rntme.contracts.crm.v1.NoteDeleted;

                    /**
                     * Encodes the specified NoteDeleted message. Does not implicitly {@link rntme.contracts.crm.v1.NoteDeleted.verify|verify} messages.
                     * @param message NoteDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.INoteDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified NoteDeleted message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.NoteDeleted.verify|verify} messages.
                     * @param message NoteDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.INoteDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a NoteDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns NoteDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.NoteDeleted;

                    /**
                     * Decodes a NoteDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns NoteDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.NoteDeleted;

                    /**
                     * Verifies a NoteDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a NoteDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns NoteDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.NoteDeleted;

                    /**
                     * Creates a plain object from a NoteDeleted message. Also converts values to other types if specified.
                     * @param message NoteDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.NoteDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this NoteDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for NoteDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AssociationCreated. */
                interface IAssociationCreated {

                    /** AssociationCreated association */
                    association?: (rntme.contracts.crm.v1.IAssociation|null);

                    /** AssociationCreated trigger */
                    trigger?: (string|null);
                }

                /** Represents an AssociationCreated. */
                class AssociationCreated implements IAssociationCreated {

                    /**
                     * Constructs a new AssociationCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAssociationCreated);

                    /** AssociationCreated association. */
                    public association?: (rntme.contracts.crm.v1.IAssociation|null);

                    /** AssociationCreated trigger. */
                    public trigger: string;

                    /**
                     * Creates a new AssociationCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AssociationCreated instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAssociationCreated): rntme.contracts.crm.v1.AssociationCreated;

                    /**
                     * Encodes the specified AssociationCreated message. Does not implicitly {@link rntme.contracts.crm.v1.AssociationCreated.verify|verify} messages.
                     * @param message AssociationCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAssociationCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AssociationCreated message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.AssociationCreated.verify|verify} messages.
                     * @param message AssociationCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAssociationCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AssociationCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AssociationCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.AssociationCreated;

                    /**
                     * Decodes an AssociationCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AssociationCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.AssociationCreated;

                    /**
                     * Verifies an AssociationCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AssociationCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AssociationCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.AssociationCreated;

                    /**
                     * Creates a plain object from an AssociationCreated message. Also converts values to other types if specified.
                     * @param message AssociationCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.AssociationCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AssociationCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AssociationCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AssociationDeleted. */
                interface IAssociationDeleted {

                    /** AssociationDeleted canonical_id */
                    canonical_id?: (string|null);

                    /** AssociationDeleted vendor_id */
                    vendor_id?: (string|null);

                    /** AssociationDeleted from */
                    from?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** AssociationDeleted to */
                    to?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** AssociationDeleted label */
                    label?: (string|null);

                    /** AssociationDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** AssociationDeleted trigger */
                    trigger?: (string|null);
                }

                /** Represents an AssociationDeleted. */
                class AssociationDeleted implements IAssociationDeleted {

                    /**
                     * Constructs a new AssociationDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAssociationDeleted);

                    /** AssociationDeleted canonical_id. */
                    public canonical_id: string;

                    /** AssociationDeleted vendor_id. */
                    public vendor_id: string;

                    /** AssociationDeleted from. */
                    public from?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** AssociationDeleted to. */
                    public to?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** AssociationDeleted label. */
                    public label: string;

                    /** AssociationDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** AssociationDeleted trigger. */
                    public trigger: string;

                    /**
                     * Creates a new AssociationDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AssociationDeleted instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAssociationDeleted): rntme.contracts.crm.v1.AssociationDeleted;

                    /**
                     * Encodes the specified AssociationDeleted message. Does not implicitly {@link rntme.contracts.crm.v1.AssociationDeleted.verify|verify} messages.
                     * @param message AssociationDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAssociationDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AssociationDeleted message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.AssociationDeleted.verify|verify} messages.
                     * @param message AssociationDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAssociationDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AssociationDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AssociationDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.AssociationDeleted;

                    /**
                     * Decodes an AssociationDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AssociationDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.AssociationDeleted;

                    /**
                     * Verifies an AssociationDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AssociationDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AssociationDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.AssociationDeleted;

                    /**
                     * Creates a plain object from an AssociationDeleted message. Also converts values to other types if specified.
                     * @param message AssociationDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.AssociationDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AssociationDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AssociationDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AsyncJobSubmitted. */
                interface IAsyncJobSubmitted {

                    /** AsyncJobSubmitted job */
                    job?: (rntme.contracts.crm.v1.IAsyncJob|null);

                    /** AsyncJobSubmitted type */
                    type?: (rntme.contracts.crm.v1.AsyncJobType|null);
                }

                /** Represents an AsyncJobSubmitted. */
                class AsyncJobSubmitted implements IAsyncJobSubmitted {

                    /**
                     * Constructs a new AsyncJobSubmitted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAsyncJobSubmitted);

                    /** AsyncJobSubmitted job. */
                    public job?: (rntme.contracts.crm.v1.IAsyncJob|null);

                    /** AsyncJobSubmitted type. */
                    public type: rntme.contracts.crm.v1.AsyncJobType;

                    /**
                     * Creates a new AsyncJobSubmitted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobSubmitted instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAsyncJobSubmitted): rntme.contracts.crm.v1.AsyncJobSubmitted;

                    /**
                     * Encodes the specified AsyncJobSubmitted message. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobSubmitted.verify|verify} messages.
                     * @param message AsyncJobSubmitted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAsyncJobSubmitted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobSubmitted message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobSubmitted.verify|verify} messages.
                     * @param message AsyncJobSubmitted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAsyncJobSubmitted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobSubmitted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobSubmitted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.AsyncJobSubmitted;

                    /**
                     * Decodes an AsyncJobSubmitted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobSubmitted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.AsyncJobSubmitted;

                    /**
                     * Verifies an AsyncJobSubmitted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AsyncJobSubmitted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AsyncJobSubmitted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.AsyncJobSubmitted;

                    /**
                     * Creates a plain object from an AsyncJobSubmitted message. Also converts values to other types if specified.
                     * @param message AsyncJobSubmitted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.AsyncJobSubmitted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AsyncJobSubmitted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AsyncJobSubmitted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AsyncJobStatusChanged. */
                interface IAsyncJobStatusChanged {

                    /** AsyncJobStatusChanged canonical_id */
                    canonical_id?: (string|null);

                    /** AsyncJobStatusChanged type */
                    type?: (rntme.contracts.crm.v1.AsyncJobType|null);

                    /** AsyncJobStatusChanged previous_status */
                    previous_status?: (rntme.contracts.crm.v1.AsyncJobStatus|null);

                    /** AsyncJobStatusChanged new_status */
                    new_status?: (rntme.contracts.crm.v1.AsyncJobStatus|null);

                    /** AsyncJobStatusChanged progress_percentage */
                    progress_percentage?: (number|null);

                    /** AsyncJobStatusChanged transitioned_at */
                    transitioned_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents an AsyncJobStatusChanged. */
                class AsyncJobStatusChanged implements IAsyncJobStatusChanged {

                    /**
                     * Constructs a new AsyncJobStatusChanged.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAsyncJobStatusChanged);

                    /** AsyncJobStatusChanged canonical_id. */
                    public canonical_id: string;

                    /** AsyncJobStatusChanged type. */
                    public type: rntme.contracts.crm.v1.AsyncJobType;

                    /** AsyncJobStatusChanged previous_status. */
                    public previous_status: rntme.contracts.crm.v1.AsyncJobStatus;

                    /** AsyncJobStatusChanged new_status. */
                    public new_status: rntme.contracts.crm.v1.AsyncJobStatus;

                    /** AsyncJobStatusChanged progress_percentage. */
                    public progress_percentage: number;

                    /** AsyncJobStatusChanged transitioned_at. */
                    public transitioned_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new AsyncJobStatusChanged instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobStatusChanged instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAsyncJobStatusChanged): rntme.contracts.crm.v1.AsyncJobStatusChanged;

                    /**
                     * Encodes the specified AsyncJobStatusChanged message. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobStatusChanged.verify|verify} messages.
                     * @param message AsyncJobStatusChanged message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAsyncJobStatusChanged, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobStatusChanged message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobStatusChanged.verify|verify} messages.
                     * @param message AsyncJobStatusChanged message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAsyncJobStatusChanged, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobStatusChanged message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobStatusChanged
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.AsyncJobStatusChanged;

                    /**
                     * Decodes an AsyncJobStatusChanged message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobStatusChanged
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.AsyncJobStatusChanged;

                    /**
                     * Verifies an AsyncJobStatusChanged message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AsyncJobStatusChanged message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AsyncJobStatusChanged
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.AsyncJobStatusChanged;

                    /**
                     * Creates a plain object from an AsyncJobStatusChanged message. Also converts values to other types if specified.
                     * @param message AsyncJobStatusChanged
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.AsyncJobStatusChanged, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AsyncJobStatusChanged to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AsyncJobStatusChanged
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AsyncJobCompleted. */
                interface IAsyncJobCompleted {

                    /** AsyncJobCompleted job */
                    job?: (rntme.contracts.crm.v1.IAsyncJob|null);
                }

                /** Represents an AsyncJobCompleted. */
                class AsyncJobCompleted implements IAsyncJobCompleted {

                    /**
                     * Constructs a new AsyncJobCompleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAsyncJobCompleted);

                    /** AsyncJobCompleted job. */
                    public job?: (rntme.contracts.crm.v1.IAsyncJob|null);

                    /**
                     * Creates a new AsyncJobCompleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobCompleted instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAsyncJobCompleted): rntme.contracts.crm.v1.AsyncJobCompleted;

                    /**
                     * Encodes the specified AsyncJobCompleted message. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobCompleted.verify|verify} messages.
                     * @param message AsyncJobCompleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAsyncJobCompleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobCompleted message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobCompleted.verify|verify} messages.
                     * @param message AsyncJobCompleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAsyncJobCompleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobCompleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobCompleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.AsyncJobCompleted;

                    /**
                     * Decodes an AsyncJobCompleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobCompleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.AsyncJobCompleted;

                    /**
                     * Verifies an AsyncJobCompleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AsyncJobCompleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AsyncJobCompleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.AsyncJobCompleted;

                    /**
                     * Creates a plain object from an AsyncJobCompleted message. Also converts values to other types if specified.
                     * @param message AsyncJobCompleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.AsyncJobCompleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AsyncJobCompleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AsyncJobCompleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AsyncJobFailed. */
                interface IAsyncJobFailed {

                    /** AsyncJobFailed job */
                    job?: (rntme.contracts.crm.v1.IAsyncJob|null);

                    /** AsyncJobFailed error_code */
                    error_code?: (string|null);

                    /** AsyncJobFailed error_message */
                    error_message?: (string|null);
                }

                /** Represents an AsyncJobFailed. */
                class AsyncJobFailed implements IAsyncJobFailed {

                    /**
                     * Constructs a new AsyncJobFailed.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAsyncJobFailed);

                    /** AsyncJobFailed job. */
                    public job?: (rntme.contracts.crm.v1.IAsyncJob|null);

                    /** AsyncJobFailed error_code. */
                    public error_code: string;

                    /** AsyncJobFailed error_message. */
                    public error_message: string;

                    /**
                     * Creates a new AsyncJobFailed instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobFailed instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAsyncJobFailed): rntme.contracts.crm.v1.AsyncJobFailed;

                    /**
                     * Encodes the specified AsyncJobFailed message. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobFailed.verify|verify} messages.
                     * @param message AsyncJobFailed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAsyncJobFailed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobFailed message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobFailed.verify|verify} messages.
                     * @param message AsyncJobFailed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAsyncJobFailed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobFailed message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobFailed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.AsyncJobFailed;

                    /**
                     * Decodes an AsyncJobFailed message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobFailed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.AsyncJobFailed;

                    /**
                     * Verifies an AsyncJobFailed message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AsyncJobFailed message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AsyncJobFailed
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.AsyncJobFailed;

                    /**
                     * Creates a plain object from an AsyncJobFailed message. Also converts values to other types if specified.
                     * @param message AsyncJobFailed
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.AsyncJobFailed, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AsyncJobFailed to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AsyncJobFailed
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** ContactStatus enum. */
                enum ContactStatus {
                    CONTACT_STATUS_UNSPECIFIED = 0,
                    CONTACT_STATUS_ACTIVE = 1,
                    CONTACT_STATUS_DELETED = 2,
                    CONTACT_STATUS_VENDOR_SPECIFIC = 100
                }

                /** CompanyStatus enum. */
                enum CompanyStatus {
                    COMPANY_STATUS_UNSPECIFIED = 0,
                    COMPANY_STATUS_ACTIVE = 1,
                    COMPANY_STATUS_DELETED = 2,
                    COMPANY_STATUS_VENDOR_SPECIFIC = 100
                }

                /** DealStatus enum. */
                enum DealStatus {
                    DEAL_STATUS_UNSPECIFIED = 0,
                    DEAL_STATUS_OPEN = 1,
                    DEAL_STATUS_WON = 2,
                    DEAL_STATUS_LOST = 3,
                    DEAL_STATUS_DELETED = 4,
                    DEAL_STATUS_VENDOR_SPECIFIC = 100
                }

                /** DealQualification enum. */
                enum DealQualification {
                    DEAL_QUALIFICATION_UNSPECIFIED = 0,
                    DEAL_QUALIFICATION_UNQUALIFIED = 1,
                    DEAL_QUALIFICATION_QUALIFIED = 2,
                    DEAL_QUALIFICATION_DISQUALIFIED = 3
                }

                /** ActivityType enum. */
                enum ActivityType {
                    ACTIVITY_TYPE_UNSPECIFIED = 0,
                    ACTIVITY_TYPE_CALL = 1,
                    ACTIVITY_TYPE_MEETING = 2,
                    ACTIVITY_TYPE_TASK = 3,
                    ACTIVITY_TYPE_EMAIL = 4,
                    ACTIVITY_TYPE_VENDOR_SPECIFIC = 100
                }

                /** ActivityOutcome enum. */
                enum ActivityOutcome {
                    ACTIVITY_OUTCOME_UNSPECIFIED = 0,
                    ACTIVITY_OUTCOME_PLANNED = 1,
                    ACTIVITY_OUTCOME_COMPLETED = 2,
                    ACTIVITY_OUTCOME_CANCELLED = 3,
                    ACTIVITY_OUTCOME_NO_ANSWER = 4,
                    ACTIVITY_OUTCOME_RESCHEDULED = 5
                }

                /** CustomFieldType enum. */
                enum CustomFieldType {
                    CUSTOM_FIELD_TYPE_UNSPECIFIED = 0,
                    CUSTOM_FIELD_TYPE_STRING = 1,
                    CUSTOM_FIELD_TYPE_NUMBER = 2,
                    CUSTOM_FIELD_TYPE_DATE = 3,
                    CUSTOM_FIELD_TYPE_DATETIME = 4,
                    CUSTOM_FIELD_TYPE_BOOLEAN = 5,
                    CUSTOM_FIELD_TYPE_ENUM = 6,
                    CUSTOM_FIELD_TYPE_MULTI_SELECT = 7,
                    CUSTOM_FIELD_TYPE_URL = 8,
                    CUSTOM_FIELD_TYPE_MONEY = 9,
                    CUSTOM_FIELD_TYPE_FILE = 10
                }

                /** StageSemantic enum. */
                enum StageSemantic {
                    STAGE_SEMANTIC_UNSPECIFIED = 0,
                    STAGE_SEMANTIC_OPEN = 1,
                    STAGE_SEMANTIC_WON = 2,
                    STAGE_SEMANTIC_LOST = 3
                }

                /** AssociationCategory enum. */
                enum AssociationCategory {
                    ASSOCIATION_CATEGORY_UNSPECIFIED = 0,
                    ASSOCIATION_CATEGORY_RNTME_DEFINED = 1,
                    ASSOCIATION_CATEGORY_USER_DEFINED = 2
                }

                /** AsyncJobType enum. */
                enum AsyncJobType {
                    ASYNC_JOB_TYPE_UNSPECIFIED = 0,
                    ASYNC_JOB_TYPE_SYNC_FULL = 1,
                    ASYNC_JOB_TYPE_VENDOR_SPECIFIC = 100
                }

                /** AsyncJobStatus enum. */
                enum AsyncJobStatus {
                    ASYNC_JOB_STATUS_UNSPECIFIED = 0,
                    ASYNC_JOB_STATUS_QUEUED = 1,
                    ASYNC_JOB_STATUS_RUNNING = 2,
                    ASYNC_JOB_STATUS_COMPLETED = 3,
                    ASYNC_JOB_STATUS_FAILED = 4,
                    ASYNC_JOB_STATUS_CANCELLED = 5,
                    ASYNC_JOB_STATUS_VENDOR_SPECIFIC = 100
                }

                /** SyncDeltaOp enum. */
                enum SyncDeltaOp {
                    SYNC_DELTA_OP_UNSPECIFIED = 0,
                    SYNC_DELTA_OP_CREATED = 1,
                    SYNC_DELTA_OP_UPDATED = 2,
                    SYNC_DELTA_OP_DELETED = 3
                }

                /** Properties of an EntityRef. */
                interface IEntityRef {

                    /** EntityRef entity_type */
                    entity_type?: (string|null);

                    /** EntityRef canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents an EntityRef. */
                class EntityRef implements IEntityRef {

                    /**
                     * Constructs a new EntityRef.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IEntityRef);

                    /** EntityRef entity_type. */
                    public entity_type: string;

                    /** EntityRef canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new EntityRef instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns EntityRef instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IEntityRef): rntme.contracts.crm.v1.EntityRef;

                    /**
                     * Encodes the specified EntityRef message. Does not implicitly {@link rntme.contracts.crm.v1.EntityRef.verify|verify} messages.
                     * @param message EntityRef message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IEntityRef, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified EntityRef message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.EntityRef.verify|verify} messages.
                     * @param message EntityRef message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IEntityRef, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an EntityRef message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns EntityRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.EntityRef;

                    /**
                     * Decodes an EntityRef message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns EntityRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.EntityRef;

                    /**
                     * Verifies an EntityRef message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an EntityRef message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns EntityRef
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.EntityRef;

                    /**
                     * Creates a plain object from an EntityRef message. Also converts values to other types if specified.
                     * @param message EntityRef
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.EntityRef, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this EntityRef to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for EntityRef
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Pipeline. */
                interface IPipeline {

                    /** Pipeline canonical_id */
                    canonical_id?: (string|null);

                    /** Pipeline vendor_id */
                    vendor_id?: (string|null);

                    /** Pipeline name */
                    name?: (string|null);

                    /** Pipeline entity_type */
                    entity_type?: (string|null);

                    /** Pipeline is_default */
                    is_default?: (boolean|null);

                    /** Pipeline stages */
                    stages?: (rntme.contracts.crm.v1.IStage[]|null);

                    /** Pipeline vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a Pipeline. */
                class Pipeline implements IPipeline {

                    /**
                     * Constructs a new Pipeline.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IPipeline);

                    /** Pipeline canonical_id. */
                    public canonical_id: string;

                    /** Pipeline vendor_id. */
                    public vendor_id: string;

                    /** Pipeline name. */
                    public name: string;

                    /** Pipeline entity_type. */
                    public entity_type: string;

                    /** Pipeline is_default. */
                    public is_default: boolean;

                    /** Pipeline stages. */
                    public stages: rntme.contracts.crm.v1.IStage[];

                    /** Pipeline vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Pipeline instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Pipeline instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IPipeline): rntme.contracts.crm.v1.Pipeline;

                    /**
                     * Encodes the specified Pipeline message. Does not implicitly {@link rntme.contracts.crm.v1.Pipeline.verify|verify} messages.
                     * @param message Pipeline message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IPipeline, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Pipeline message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.Pipeline.verify|verify} messages.
                     * @param message Pipeline message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IPipeline, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Pipeline message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Pipeline
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.Pipeline;

                    /**
                     * Decodes a Pipeline message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Pipeline
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.Pipeline;

                    /**
                     * Verifies a Pipeline message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Pipeline message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Pipeline
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.Pipeline;

                    /**
                     * Creates a plain object from a Pipeline message. Also converts values to other types if specified.
                     * @param message Pipeline
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.Pipeline, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Pipeline to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Pipeline
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Stage. */
                interface IStage {

                    /** Stage canonical_id */
                    canonical_id?: (string|null);

                    /** Stage vendor_id */
                    vendor_id?: (string|null);

                    /** Stage pipeline_canonical_id */
                    pipeline_canonical_id?: (string|null);

                    /** Stage name */
                    name?: (string|null);

                    /** Stage order */
                    order?: (number|null);

                    /** Stage semantic */
                    semantic?: (rntme.contracts.crm.v1.StageSemantic|null);

                    /** Stage probability */
                    probability?: (number|null);

                    /** Stage is_terminal */
                    is_terminal?: (boolean|null);
                }

                /** Represents a Stage. */
                class Stage implements IStage {

                    /**
                     * Constructs a new Stage.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IStage);

                    /** Stage canonical_id. */
                    public canonical_id: string;

                    /** Stage vendor_id. */
                    public vendor_id: string;

                    /** Stage pipeline_canonical_id. */
                    public pipeline_canonical_id: string;

                    /** Stage name. */
                    public name: string;

                    /** Stage order. */
                    public order: number;

                    /** Stage semantic. */
                    public semantic: rntme.contracts.crm.v1.StageSemantic;

                    /** Stage probability. */
                    public probability: number;

                    /** Stage is_terminal. */
                    public is_terminal: boolean;

                    /**
                     * Creates a new Stage instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Stage instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IStage): rntme.contracts.crm.v1.Stage;

                    /**
                     * Encodes the specified Stage message. Does not implicitly {@link rntme.contracts.crm.v1.Stage.verify|verify} messages.
                     * @param message Stage message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IStage, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Stage message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.Stage.verify|verify} messages.
                     * @param message Stage message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IStage, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Stage message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Stage
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.Stage;

                    /**
                     * Decodes a Stage message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Stage
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.Stage;

                    /**
                     * Verifies a Stage message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Stage message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Stage
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.Stage;

                    /**
                     * Creates a plain object from a Stage message. Also converts values to other types if specified.
                     * @param message Stage
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.Stage, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Stage to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Stage
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an Owner. */
                interface IOwner {

                    /** Owner canonical_id */
                    canonical_id?: (string|null);

                    /** Owner vendor_id */
                    vendor_id?: (string|null);

                    /** Owner email */
                    email?: (string|null);

                    /** Owner name */
                    name?: (rntme.contracts.common.v1.IName|null);

                    /** Owner is_active */
                    is_active?: (boolean|null);
                }

                /** Represents an Owner. */
                class Owner implements IOwner {

                    /**
                     * Constructs a new Owner.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IOwner);

                    /** Owner canonical_id. */
                    public canonical_id: string;

                    /** Owner vendor_id. */
                    public vendor_id: string;

                    /** Owner email. */
                    public email: string;

                    /** Owner name. */
                    public name?: (rntme.contracts.common.v1.IName|null);

                    /** Owner is_active. */
                    public is_active: boolean;

                    /**
                     * Creates a new Owner instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Owner instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IOwner): rntme.contracts.crm.v1.Owner;

                    /**
                     * Encodes the specified Owner message. Does not implicitly {@link rntme.contracts.crm.v1.Owner.verify|verify} messages.
                     * @param message Owner message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IOwner, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Owner message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.Owner.verify|verify} messages.
                     * @param message Owner message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IOwner, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an Owner message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Owner
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.Owner;

                    /**
                     * Decodes an Owner message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Owner
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.Owner;

                    /**
                     * Verifies an Owner message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an Owner message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Owner
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.Owner;

                    /**
                     * Creates a plain object from an Owner message. Also converts values to other types if specified.
                     * @param message Owner
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.Owner, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Owner to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Owner
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CustomFieldDefinition. */
                interface ICustomFieldDefinition {

                    /** CustomFieldDefinition entity_type */
                    entity_type?: (string|null);

                    /** CustomFieldDefinition logical_name */
                    logical_name?: (string|null);

                    /** CustomFieldDefinition vendor_key */
                    vendor_key?: (string|null);

                    /** CustomFieldDefinition field_type */
                    field_type?: (rntme.contracts.crm.v1.CustomFieldType|null);

                    /** CustomFieldDefinition label */
                    label?: (string|null);

                    /** CustomFieldDefinition is_required */
                    is_required?: (boolean|null);

                    /** CustomFieldDefinition options */
                    options?: (string[]|null);

                    /** CustomFieldDefinition vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a CustomFieldDefinition. */
                class CustomFieldDefinition implements ICustomFieldDefinition {

                    /**
                     * Constructs a new CustomFieldDefinition.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICustomFieldDefinition);

                    /** CustomFieldDefinition entity_type. */
                    public entity_type: string;

                    /** CustomFieldDefinition logical_name. */
                    public logical_name: string;

                    /** CustomFieldDefinition vendor_key. */
                    public vendor_key: string;

                    /** CustomFieldDefinition field_type. */
                    public field_type: rntme.contracts.crm.v1.CustomFieldType;

                    /** CustomFieldDefinition label. */
                    public label: string;

                    /** CustomFieldDefinition is_required. */
                    public is_required: boolean;

                    /** CustomFieldDefinition options. */
                    public options: string[];

                    /** CustomFieldDefinition vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new CustomFieldDefinition instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CustomFieldDefinition instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICustomFieldDefinition): rntme.contracts.crm.v1.CustomFieldDefinition;

                    /**
                     * Encodes the specified CustomFieldDefinition message. Does not implicitly {@link rntme.contracts.crm.v1.CustomFieldDefinition.verify|verify} messages.
                     * @param message CustomFieldDefinition message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICustomFieldDefinition, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CustomFieldDefinition message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CustomFieldDefinition.verify|verify} messages.
                     * @param message CustomFieldDefinition message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICustomFieldDefinition, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CustomFieldDefinition message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CustomFieldDefinition
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CustomFieldDefinition;

                    /**
                     * Decodes a CustomFieldDefinition message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CustomFieldDefinition
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CustomFieldDefinition;

                    /**
                     * Verifies a CustomFieldDefinition message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CustomFieldDefinition message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CustomFieldDefinition
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CustomFieldDefinition;

                    /**
                     * Creates a plain object from a CustomFieldDefinition message. Also converts values to other types if specified.
                     * @param message CustomFieldDefinition
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CustomFieldDefinition, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CustomFieldDefinition to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CustomFieldDefinition
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an Association. */
                interface IAssociation {

                    /** Association ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Association from */
                    from?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** Association to */
                    to?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** Association category */
                    category?: (rntme.contracts.crm.v1.AssociationCategory|null);

                    /** Association label */
                    label?: (string|null);

                    /** Association metadata */
                    metadata?: (google.protobuf.IStruct|null);

                    /** Association created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** Association vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents an Association. */
                class Association implements IAssociation {

                    /**
                     * Constructs a new Association.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAssociation);

                    /** Association ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Association from. */
                    public from?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** Association to. */
                    public to?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** Association category. */
                    public category: rntme.contracts.crm.v1.AssociationCategory;

                    /** Association label. */
                    public label: string;

                    /** Association metadata. */
                    public metadata?: (google.protobuf.IStruct|null);

                    /** Association created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** Association vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Association instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Association instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAssociation): rntme.contracts.crm.v1.Association;

                    /**
                     * Encodes the specified Association message. Does not implicitly {@link rntme.contracts.crm.v1.Association.verify|verify} messages.
                     * @param message Association message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAssociation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Association message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.Association.verify|verify} messages.
                     * @param message Association message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAssociation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an Association message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Association
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.Association;

                    /**
                     * Decodes an Association message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Association
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.Association;

                    /**
                     * Verifies an Association message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an Association message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Association
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.Association;

                    /**
                     * Creates a plain object from an Association message. Also converts values to other types if specified.
                     * @param message Association
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.Association, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Association to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Association
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Contact. */
                interface IContact {

                    /** Contact ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Contact email */
                    email?: (string|null);

                    /** Contact phone */
                    phone?: (string|null);

                    /** Contact name */
                    name?: (rntme.contracts.common.v1.IName|null);

                    /** Contact title */
                    title?: (string|null);

                    /** Contact company_canonical_id */
                    company_canonical_id?: (string|null);

                    /** Contact owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** Contact tags */
                    tags?: (string[]|null);

                    /** Contact status */
                    status?: (rntme.contracts.crm.v1.ContactStatus|null);

                    /** Contact metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Contact created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** Contact updated_at */
                    updated_at?: (google.protobuf.ITimestamp|null);

                    /** Contact deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** Contact vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a Contact. */
                class Contact implements IContact {

                    /**
                     * Constructs a new Contact.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IContact);

                    /** Contact ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Contact email. */
                    public email: string;

                    /** Contact phone. */
                    public phone: string;

                    /** Contact name. */
                    public name?: (rntme.contracts.common.v1.IName|null);

                    /** Contact title. */
                    public title: string;

                    /** Contact company_canonical_id. */
                    public company_canonical_id: string;

                    /** Contact owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** Contact tags. */
                    public tags: string[];

                    /** Contact status. */
                    public status: rntme.contracts.crm.v1.ContactStatus;

                    /** Contact metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Contact created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** Contact updated_at. */
                    public updated_at?: (google.protobuf.ITimestamp|null);

                    /** Contact deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** Contact vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Contact instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Contact instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IContact): rntme.contracts.crm.v1.Contact;

                    /**
                     * Encodes the specified Contact message. Does not implicitly {@link rntme.contracts.crm.v1.Contact.verify|verify} messages.
                     * @param message Contact message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IContact, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Contact message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.Contact.verify|verify} messages.
                     * @param message Contact message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IContact, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Contact message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Contact
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.Contact;

                    /**
                     * Decodes a Contact message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Contact
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.Contact;

                    /**
                     * Verifies a Contact message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Contact message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Contact
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.Contact;

                    /**
                     * Creates a plain object from a Contact message. Also converts values to other types if specified.
                     * @param message Contact
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.Contact, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Contact to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Contact
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Company. */
                interface ICompany {

                    /** Company ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Company name */
                    name?: (string|null);

                    /** Company domain */
                    domain?: (string|null);

                    /** Company industry */
                    industry?: (string|null);

                    /** Company employee_count */
                    employee_count?: (number|null);

                    /** Company annual_revenue */
                    annual_revenue?: (number|null);

                    /** Company currency */
                    currency?: (string|null);

                    /** Company tax_id */
                    tax_id?: (string|null);

                    /** Company registration_id */
                    registration_id?: (string|null);

                    /** Company tax_branch_id */
                    tax_branch_id?: (string|null);

                    /** Company parent_company_canonical_id */
                    parent_company_canonical_id?: (string|null);

                    /** Company owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** Company tags */
                    tags?: (string[]|null);

                    /** Company status */
                    status?: (rntme.contracts.crm.v1.CompanyStatus|null);

                    /** Company metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Company created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** Company updated_at */
                    updated_at?: (google.protobuf.ITimestamp|null);

                    /** Company deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** Company vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a Company. */
                class Company implements ICompany {

                    /**
                     * Constructs a new Company.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICompany);

                    /** Company ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Company name. */
                    public name: string;

                    /** Company domain. */
                    public domain: string;

                    /** Company industry. */
                    public industry: string;

                    /** Company employee_count. */
                    public employee_count: number;

                    /** Company annual_revenue. */
                    public annual_revenue: number;

                    /** Company currency. */
                    public currency: string;

                    /** Company tax_id. */
                    public tax_id: string;

                    /** Company registration_id. */
                    public registration_id: string;

                    /** Company tax_branch_id. */
                    public tax_branch_id: string;

                    /** Company parent_company_canonical_id. */
                    public parent_company_canonical_id: string;

                    /** Company owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** Company tags. */
                    public tags: string[];

                    /** Company status. */
                    public status: rntme.contracts.crm.v1.CompanyStatus;

                    /** Company metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Company created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** Company updated_at. */
                    public updated_at?: (google.protobuf.ITimestamp|null);

                    /** Company deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** Company vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Company instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Company instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICompany): rntme.contracts.crm.v1.Company;

                    /**
                     * Encodes the specified Company message. Does not implicitly {@link rntme.contracts.crm.v1.Company.verify|verify} messages.
                     * @param message Company message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICompany, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Company message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.Company.verify|verify} messages.
                     * @param message Company message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICompany, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Company message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Company
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.Company;

                    /**
                     * Decodes a Company message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Company
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.Company;

                    /**
                     * Verifies a Company message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Company message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Company
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.Company;

                    /**
                     * Creates a plain object from a Company message. Also converts values to other types if specified.
                     * @param message Company
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.Company, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Company to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Company
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Deal. */
                interface IDeal {

                    /** Deal ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Deal name */
                    name?: (string|null);

                    /** Deal pipeline_canonical_id */
                    pipeline_canonical_id?: (string|null);

                    /** Deal stage_canonical_id */
                    stage_canonical_id?: (string|null);

                    /** Deal status */
                    status?: (rntme.contracts.crm.v1.DealStatus|null);

                    /** Deal qualification */
                    qualification?: (rntme.contracts.crm.v1.DealQualification|null);

                    /** Deal amount */
                    amount?: (number|null);

                    /** Deal currency */
                    currency?: (string|null);

                    /** Deal probability */
                    probability?: (number|null);

                    /** Deal expected_close_date */
                    expected_close_date?: (google.protobuf.ITimestamp|null);

                    /** Deal closed_at */
                    closed_at?: (google.protobuf.ITimestamp|null);

                    /** Deal close_reason */
                    close_reason?: (string|null);

                    /** Deal primary_contact_canonical_id */
                    primary_contact_canonical_id?: (string|null);

                    /** Deal company_canonical_id */
                    company_canonical_id?: (string|null);

                    /** Deal owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** Deal tags */
                    tags?: (string[]|null);

                    /** Deal source */
                    source?: (string|null);

                    /** Deal metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Deal created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** Deal updated_at */
                    updated_at?: (google.protobuf.ITimestamp|null);

                    /** Deal deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);

                    /** Deal vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a Deal. */
                class Deal implements IDeal {

                    /**
                     * Constructs a new Deal.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDeal);

                    /** Deal ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Deal name. */
                    public name: string;

                    /** Deal pipeline_canonical_id. */
                    public pipeline_canonical_id: string;

                    /** Deal stage_canonical_id. */
                    public stage_canonical_id: string;

                    /** Deal status. */
                    public status: rntme.contracts.crm.v1.DealStatus;

                    /** Deal qualification. */
                    public qualification: rntme.contracts.crm.v1.DealQualification;

                    /** Deal amount. */
                    public amount: number;

                    /** Deal currency. */
                    public currency: string;

                    /** Deal probability. */
                    public probability: number;

                    /** Deal expected_close_date. */
                    public expected_close_date?: (google.protobuf.ITimestamp|null);

                    /** Deal closed_at. */
                    public closed_at?: (google.protobuf.ITimestamp|null);

                    /** Deal close_reason. */
                    public close_reason: string;

                    /** Deal primary_contact_canonical_id. */
                    public primary_contact_canonical_id: string;

                    /** Deal company_canonical_id. */
                    public company_canonical_id: string;

                    /** Deal owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** Deal tags. */
                    public tags: string[];

                    /** Deal source. */
                    public source: string;

                    /** Deal metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Deal created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** Deal updated_at. */
                    public updated_at?: (google.protobuf.ITimestamp|null);

                    /** Deal deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /** Deal vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Deal instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Deal instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDeal): rntme.contracts.crm.v1.Deal;

                    /**
                     * Encodes the specified Deal message. Does not implicitly {@link rntme.contracts.crm.v1.Deal.verify|verify} messages.
                     * @param message Deal message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDeal, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Deal message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.Deal.verify|verify} messages.
                     * @param message Deal message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDeal, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Deal message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Deal
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.Deal;

                    /**
                     * Decodes a Deal message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Deal
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.Deal;

                    /**
                     * Verifies a Deal message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Deal message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Deal
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.Deal;

                    /**
                     * Creates a plain object from a Deal message. Also converts values to other types if specified.
                     * @param message Deal
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.Deal, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Deal to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Deal
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an Activity. */
                interface IActivity {

                    /** Activity ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Activity type */
                    type?: (rntme.contracts.crm.v1.ActivityType|null);

                    /** Activity subject */
                    subject?: (string|null);

                    /** Activity description */
                    description?: (string|null);

                    /** Activity due_at */
                    due_at?: (google.protobuf.ITimestamp|null);

                    /** Activity completed_at */
                    completed_at?: (google.protobuf.ITimestamp|null);

                    /** Activity duration */
                    duration?: (google.protobuf.IDuration|null);

                    /** Activity outcome */
                    outcome?: (rntme.contracts.crm.v1.ActivityOutcome|null);

                    /** Activity is_completed */
                    is_completed?: (boolean|null);

                    /** Activity linked_entities */
                    linked_entities?: (rntme.contracts.crm.v1.IEntityRef[]|null);

                    /** Activity owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** Activity metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Activity created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** Activity updated_at */
                    updated_at?: (google.protobuf.ITimestamp|null);

                    /** Activity vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents an Activity. */
                class Activity implements IActivity {

                    /**
                     * Constructs a new Activity.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IActivity);

                    /** Activity ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Activity type. */
                    public type: rntme.contracts.crm.v1.ActivityType;

                    /** Activity subject. */
                    public subject: string;

                    /** Activity description. */
                    public description: string;

                    /** Activity due_at. */
                    public due_at?: (google.protobuf.ITimestamp|null);

                    /** Activity completed_at. */
                    public completed_at?: (google.protobuf.ITimestamp|null);

                    /** Activity duration. */
                    public duration?: (google.protobuf.IDuration|null);

                    /** Activity outcome. */
                    public outcome: rntme.contracts.crm.v1.ActivityOutcome;

                    /** Activity is_completed. */
                    public is_completed: boolean;

                    /** Activity linked_entities. */
                    public linked_entities: rntme.contracts.crm.v1.IEntityRef[];

                    /** Activity owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** Activity metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Activity created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** Activity updated_at. */
                    public updated_at?: (google.protobuf.ITimestamp|null);

                    /** Activity vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Activity instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Activity instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IActivity): rntme.contracts.crm.v1.Activity;

                    /**
                     * Encodes the specified Activity message. Does not implicitly {@link rntme.contracts.crm.v1.Activity.verify|verify} messages.
                     * @param message Activity message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IActivity, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Activity message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.Activity.verify|verify} messages.
                     * @param message Activity message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IActivity, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an Activity message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Activity
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.Activity;

                    /**
                     * Decodes an Activity message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Activity
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.Activity;

                    /**
                     * Verifies an Activity message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an Activity message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Activity
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.Activity;

                    /**
                     * Creates a plain object from an Activity message. Also converts values to other types if specified.
                     * @param message Activity
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.Activity, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Activity to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Activity
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Note. */
                interface INote {

                    /** Note ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Note content */
                    content?: (string|null);

                    /** Note title */
                    title?: (string|null);

                    /** Note parent */
                    parent?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** Note author_canonical_id */
                    author_canonical_id?: (string|null);

                    /** Note metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Note created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** Note updated_at */
                    updated_at?: (google.protobuf.ITimestamp|null);

                    /** Note vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a Note. */
                class Note implements INote {

                    /**
                     * Constructs a new Note.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.INote);

                    /** Note ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Note content. */
                    public content: string;

                    /** Note title. */
                    public title: string;

                    /** Note parent. */
                    public parent?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** Note author_canonical_id. */
                    public author_canonical_id: string;

                    /** Note metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** Note created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** Note updated_at. */
                    public updated_at?: (google.protobuf.ITimestamp|null);

                    /** Note vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Note instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Note instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.INote): rntme.contracts.crm.v1.Note;

                    /**
                     * Encodes the specified Note message. Does not implicitly {@link rntme.contracts.crm.v1.Note.verify|verify} messages.
                     * @param message Note message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.INote, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Note message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.Note.verify|verify} messages.
                     * @param message Note message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.INote, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Note message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Note
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.Note;

                    /**
                     * Decodes a Note message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Note
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.Note;

                    /**
                     * Verifies a Note message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Note message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Note
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.Note;

                    /**
                     * Creates a plain object from a Note message. Also converts values to other types if specified.
                     * @param message Note
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.Note, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Note to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Note
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AsyncJob. */
                interface IAsyncJob {

                    /** AsyncJob ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** AsyncJob type */
                    type?: (rntme.contracts.crm.v1.AsyncJobType|null);

                    /** AsyncJob status */
                    status?: (rntme.contracts.crm.v1.AsyncJobStatus|null);

                    /** AsyncJob progress_percentage */
                    progress_percentage?: (number|null);

                    /** AsyncJob result_uri */
                    result_uri?: (string|null);

                    /** AsyncJob record_count */
                    record_count?: (number|Long|null);

                    /** AsyncJob error_message */
                    error_message?: (string|null);

                    /** AsyncJob created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** AsyncJob completed_at */
                    completed_at?: (google.protobuf.ITimestamp|null);

                    /** AsyncJob expires_at */
                    expires_at?: (google.protobuf.ITimestamp|null);

                    /** AsyncJob vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents an AsyncJob. */
                class AsyncJob implements IAsyncJob {

                    /**
                     * Constructs a new AsyncJob.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAsyncJob);

                    /** AsyncJob ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** AsyncJob type. */
                    public type: rntme.contracts.crm.v1.AsyncJobType;

                    /** AsyncJob status. */
                    public status: rntme.contracts.crm.v1.AsyncJobStatus;

                    /** AsyncJob progress_percentage. */
                    public progress_percentage: number;

                    /** AsyncJob result_uri. */
                    public result_uri: string;

                    /** AsyncJob record_count. */
                    public record_count: (number|Long);

                    /** AsyncJob error_message. */
                    public error_message: string;

                    /** AsyncJob created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** AsyncJob completed_at. */
                    public completed_at?: (google.protobuf.ITimestamp|null);

                    /** AsyncJob expires_at. */
                    public expires_at?: (google.protobuf.ITimestamp|null);

                    /** AsyncJob vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new AsyncJob instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJob instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAsyncJob): rntme.contracts.crm.v1.AsyncJob;

                    /**
                     * Encodes the specified AsyncJob message. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJob.verify|verify} messages.
                     * @param message AsyncJob message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAsyncJob, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJob message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJob.verify|verify} messages.
                     * @param message AsyncJob message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAsyncJob, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJob message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJob
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.AsyncJob;

                    /**
                     * Decodes an AsyncJob message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJob
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.AsyncJob;

                    /**
                     * Verifies an AsyncJob message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AsyncJob message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AsyncJob
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.AsyncJob;

                    /**
                     * Creates a plain object from an AsyncJob message. Also converts values to other types if specified.
                     * @param message AsyncJob
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.AsyncJob, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AsyncJob to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AsyncJob
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SyncFullPayload. */
                interface ISyncFullPayload {

                    /** SyncFullPayload entity_types */
                    entity_types?: (string[]|null);

                    /** SyncFullPayload since */
                    since?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a SyncFullPayload. */
                class SyncFullPayload implements ISyncFullPayload {

                    /**
                     * Constructs a new SyncFullPayload.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ISyncFullPayload);

                    /** SyncFullPayload entity_types. */
                    public entity_types: string[];

                    /** SyncFullPayload since. */
                    public since?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new SyncFullPayload instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SyncFullPayload instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ISyncFullPayload): rntme.contracts.crm.v1.SyncFullPayload;

                    /**
                     * Encodes the specified SyncFullPayload message. Does not implicitly {@link rntme.contracts.crm.v1.SyncFullPayload.verify|verify} messages.
                     * @param message SyncFullPayload message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ISyncFullPayload, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SyncFullPayload message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.SyncFullPayload.verify|verify} messages.
                     * @param message SyncFullPayload message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ISyncFullPayload, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SyncFullPayload message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SyncFullPayload
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.SyncFullPayload;

                    /**
                     * Decodes a SyncFullPayload message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SyncFullPayload
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.SyncFullPayload;

                    /**
                     * Verifies a SyncFullPayload message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SyncFullPayload message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SyncFullPayload
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.SyncFullPayload;

                    /**
                     * Creates a plain object from a SyncFullPayload message. Also converts values to other types if specified.
                     * @param message SyncFullPayload
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.SyncFullPayload, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SyncFullPayload to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SyncFullPayload
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Represents a CrmModule */
                class CrmModule extends $protobuf.rpc.Service {

                    /**
                     * Constructs a new CrmModule service.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     */
                    constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                    /**
                     * Creates new CrmModule service using the specified rpc implementation.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     * @returns RPC service. Useful where requests and/or responses are streamed.
                     */
                    public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): CrmModule;

                    /**
                     * Calls GetContact.
                     * @param request GetContactRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Contact
                     */
                    public getContact(request: rntme.contracts.crm.v1.IGetContactRequest, callback: rntme.contracts.crm.v1.CrmModule.GetContactCallback): void;

                    /**
                     * Calls GetContact.
                     * @param request GetContactRequest message or plain object
                     * @returns Promise
                     */
                    public getContact(request: rntme.contracts.crm.v1.IGetContactRequest): Promise<rntme.contracts.crm.v1.Contact>;

                    /**
                     * Calls ListContacts.
                     * @param request ListContactsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ContactList
                     */
                    public listContacts(request: rntme.contracts.crm.v1.IListContactsRequest, callback: rntme.contracts.crm.v1.CrmModule.ListContactsCallback): void;

                    /**
                     * Calls ListContacts.
                     * @param request ListContactsRequest message or plain object
                     * @returns Promise
                     */
                    public listContacts(request: rntme.contracts.crm.v1.IListContactsRequest): Promise<rntme.contracts.crm.v1.ContactList>;

                    /**
                     * Calls CreateContact.
                     * @param request CreateContactRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Contact
                     */
                    public createContact(request: rntme.contracts.crm.v1.ICreateContactRequest, callback: rntme.contracts.crm.v1.CrmModule.CreateContactCallback): void;

                    /**
                     * Calls CreateContact.
                     * @param request CreateContactRequest message or plain object
                     * @returns Promise
                     */
                    public createContact(request: rntme.contracts.crm.v1.ICreateContactRequest): Promise<rntme.contracts.crm.v1.Contact>;

                    /**
                     * Calls UpdateContact.
                     * @param request UpdateContactRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Contact
                     */
                    public updateContact(request: rntme.contracts.crm.v1.IUpdateContactRequest, callback: rntme.contracts.crm.v1.CrmModule.UpdateContactCallback): void;

                    /**
                     * Calls UpdateContact.
                     * @param request UpdateContactRequest message or plain object
                     * @returns Promise
                     */
                    public updateContact(request: rntme.contracts.crm.v1.IUpdateContactRequest): Promise<rntme.contracts.crm.v1.Contact>;

                    /**
                     * Calls DeleteContact.
                     * @param request DeleteContactRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Contact
                     */
                    public deleteContact(request: rntme.contracts.crm.v1.IDeleteContactRequest, callback: rntme.contracts.crm.v1.CrmModule.DeleteContactCallback): void;

                    /**
                     * Calls DeleteContact.
                     * @param request DeleteContactRequest message or plain object
                     * @returns Promise
                     */
                    public deleteContact(request: rntme.contracts.crm.v1.IDeleteContactRequest): Promise<rntme.contracts.crm.v1.Contact>;

                    /**
                     * Calls GetCompany.
                     * @param request GetCompanyRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Company
                     */
                    public getCompany(request: rntme.contracts.crm.v1.IGetCompanyRequest, callback: rntme.contracts.crm.v1.CrmModule.GetCompanyCallback): void;

                    /**
                     * Calls GetCompany.
                     * @param request GetCompanyRequest message or plain object
                     * @returns Promise
                     */
                    public getCompany(request: rntme.contracts.crm.v1.IGetCompanyRequest): Promise<rntme.contracts.crm.v1.Company>;

                    /**
                     * Calls ListCompanies.
                     * @param request ListCompaniesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and CompanyList
                     */
                    public listCompanies(request: rntme.contracts.crm.v1.IListCompaniesRequest, callback: rntme.contracts.crm.v1.CrmModule.ListCompaniesCallback): void;

                    /**
                     * Calls ListCompanies.
                     * @param request ListCompaniesRequest message or plain object
                     * @returns Promise
                     */
                    public listCompanies(request: rntme.contracts.crm.v1.IListCompaniesRequest): Promise<rntme.contracts.crm.v1.CompanyList>;

                    /**
                     * Calls CreateCompany.
                     * @param request CreateCompanyRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Company
                     */
                    public createCompany(request: rntme.contracts.crm.v1.ICreateCompanyRequest, callback: rntme.contracts.crm.v1.CrmModule.CreateCompanyCallback): void;

                    /**
                     * Calls CreateCompany.
                     * @param request CreateCompanyRequest message or plain object
                     * @returns Promise
                     */
                    public createCompany(request: rntme.contracts.crm.v1.ICreateCompanyRequest): Promise<rntme.contracts.crm.v1.Company>;

                    /**
                     * Calls UpdateCompany.
                     * @param request UpdateCompanyRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Company
                     */
                    public updateCompany(request: rntme.contracts.crm.v1.IUpdateCompanyRequest, callback: rntme.contracts.crm.v1.CrmModule.UpdateCompanyCallback): void;

                    /**
                     * Calls UpdateCompany.
                     * @param request UpdateCompanyRequest message or plain object
                     * @returns Promise
                     */
                    public updateCompany(request: rntme.contracts.crm.v1.IUpdateCompanyRequest): Promise<rntme.contracts.crm.v1.Company>;

                    /**
                     * Calls DeleteCompany.
                     * @param request DeleteCompanyRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Company
                     */
                    public deleteCompany(request: rntme.contracts.crm.v1.IDeleteCompanyRequest, callback: rntme.contracts.crm.v1.CrmModule.DeleteCompanyCallback): void;

                    /**
                     * Calls DeleteCompany.
                     * @param request DeleteCompanyRequest message or plain object
                     * @returns Promise
                     */
                    public deleteCompany(request: rntme.contracts.crm.v1.IDeleteCompanyRequest): Promise<rntme.contracts.crm.v1.Company>;

                    /**
                     * Calls GetDeal.
                     * @param request GetDealRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Deal
                     */
                    public getDeal(request: rntme.contracts.crm.v1.IGetDealRequest, callback: rntme.contracts.crm.v1.CrmModule.GetDealCallback): void;

                    /**
                     * Calls GetDeal.
                     * @param request GetDealRequest message or plain object
                     * @returns Promise
                     */
                    public getDeal(request: rntme.contracts.crm.v1.IGetDealRequest): Promise<rntme.contracts.crm.v1.Deal>;

                    /**
                     * Calls ListDeals.
                     * @param request ListDealsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and DealList
                     */
                    public listDeals(request: rntme.contracts.crm.v1.IListDealsRequest, callback: rntme.contracts.crm.v1.CrmModule.ListDealsCallback): void;

                    /**
                     * Calls ListDeals.
                     * @param request ListDealsRequest message or plain object
                     * @returns Promise
                     */
                    public listDeals(request: rntme.contracts.crm.v1.IListDealsRequest): Promise<rntme.contracts.crm.v1.DealList>;

                    /**
                     * Calls CreateDeal.
                     * @param request CreateDealRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Deal
                     */
                    public createDeal(request: rntme.contracts.crm.v1.ICreateDealRequest, callback: rntme.contracts.crm.v1.CrmModule.CreateDealCallback): void;

                    /**
                     * Calls CreateDeal.
                     * @param request CreateDealRequest message or plain object
                     * @returns Promise
                     */
                    public createDeal(request: rntme.contracts.crm.v1.ICreateDealRequest): Promise<rntme.contracts.crm.v1.Deal>;

                    /**
                     * Calls UpdateDeal.
                     * @param request UpdateDealRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Deal
                     */
                    public updateDeal(request: rntme.contracts.crm.v1.IUpdateDealRequest, callback: rntme.contracts.crm.v1.CrmModule.UpdateDealCallback): void;

                    /**
                     * Calls UpdateDeal.
                     * @param request UpdateDealRequest message or plain object
                     * @returns Promise
                     */
                    public updateDeal(request: rntme.contracts.crm.v1.IUpdateDealRequest): Promise<rntme.contracts.crm.v1.Deal>;

                    /**
                     * Calls DeleteDeal.
                     * @param request DeleteDealRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Deal
                     */
                    public deleteDeal(request: rntme.contracts.crm.v1.IDeleteDealRequest, callback: rntme.contracts.crm.v1.CrmModule.DeleteDealCallback): void;

                    /**
                     * Calls DeleteDeal.
                     * @param request DeleteDealRequest message or plain object
                     * @returns Promise
                     */
                    public deleteDeal(request: rntme.contracts.crm.v1.IDeleteDealRequest): Promise<rntme.contracts.crm.v1.Deal>;

                    /**
                     * Calls GetActivity.
                     * @param request GetActivityRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Activity
                     */
                    public getActivity(request: rntme.contracts.crm.v1.IGetActivityRequest, callback: rntme.contracts.crm.v1.CrmModule.GetActivityCallback): void;

                    /**
                     * Calls GetActivity.
                     * @param request GetActivityRequest message or plain object
                     * @returns Promise
                     */
                    public getActivity(request: rntme.contracts.crm.v1.IGetActivityRequest): Promise<rntme.contracts.crm.v1.Activity>;

                    /**
                     * Calls ListActivities.
                     * @param request ListActivitiesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ActivityList
                     */
                    public listActivities(request: rntme.contracts.crm.v1.IListActivitiesRequest, callback: rntme.contracts.crm.v1.CrmModule.ListActivitiesCallback): void;

                    /**
                     * Calls ListActivities.
                     * @param request ListActivitiesRequest message or plain object
                     * @returns Promise
                     */
                    public listActivities(request: rntme.contracts.crm.v1.IListActivitiesRequest): Promise<rntme.contracts.crm.v1.ActivityList>;

                    /**
                     * Calls CreateActivity.
                     * @param request CreateActivityRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Activity
                     */
                    public createActivity(request: rntme.contracts.crm.v1.ICreateActivityRequest, callback: rntme.contracts.crm.v1.CrmModule.CreateActivityCallback): void;

                    /**
                     * Calls CreateActivity.
                     * @param request CreateActivityRequest message or plain object
                     * @returns Promise
                     */
                    public createActivity(request: rntme.contracts.crm.v1.ICreateActivityRequest): Promise<rntme.contracts.crm.v1.Activity>;

                    /**
                     * Calls UpdateActivity.
                     * @param request UpdateActivityRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Activity
                     */
                    public updateActivity(request: rntme.contracts.crm.v1.IUpdateActivityRequest, callback: rntme.contracts.crm.v1.CrmModule.UpdateActivityCallback): void;

                    /**
                     * Calls UpdateActivity.
                     * @param request UpdateActivityRequest message or plain object
                     * @returns Promise
                     */
                    public updateActivity(request: rntme.contracts.crm.v1.IUpdateActivityRequest): Promise<rntme.contracts.crm.v1.Activity>;

                    /**
                     * Calls DeleteActivity.
                     * @param request DeleteActivityRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Activity
                     */
                    public deleteActivity(request: rntme.contracts.crm.v1.IDeleteActivityRequest, callback: rntme.contracts.crm.v1.CrmModule.DeleteActivityCallback): void;

                    /**
                     * Calls DeleteActivity.
                     * @param request DeleteActivityRequest message or plain object
                     * @returns Promise
                     */
                    public deleteActivity(request: rntme.contracts.crm.v1.IDeleteActivityRequest): Promise<rntme.contracts.crm.v1.Activity>;

                    /**
                     * Calls GetNote.
                     * @param request GetNoteRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Note
                     */
                    public getNote(request: rntme.contracts.crm.v1.IGetNoteRequest, callback: rntme.contracts.crm.v1.CrmModule.GetNoteCallback): void;

                    /**
                     * Calls GetNote.
                     * @param request GetNoteRequest message or plain object
                     * @returns Promise
                     */
                    public getNote(request: rntme.contracts.crm.v1.IGetNoteRequest): Promise<rntme.contracts.crm.v1.Note>;

                    /**
                     * Calls ListNotes.
                     * @param request ListNotesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and NoteList
                     */
                    public listNotes(request: rntme.contracts.crm.v1.IListNotesRequest, callback: rntme.contracts.crm.v1.CrmModule.ListNotesCallback): void;

                    /**
                     * Calls ListNotes.
                     * @param request ListNotesRequest message or plain object
                     * @returns Promise
                     */
                    public listNotes(request: rntme.contracts.crm.v1.IListNotesRequest): Promise<rntme.contracts.crm.v1.NoteList>;

                    /**
                     * Calls CreateNote.
                     * @param request CreateNoteRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Note
                     */
                    public createNote(request: rntme.contracts.crm.v1.ICreateNoteRequest, callback: rntme.contracts.crm.v1.CrmModule.CreateNoteCallback): void;

                    /**
                     * Calls CreateNote.
                     * @param request CreateNoteRequest message or plain object
                     * @returns Promise
                     */
                    public createNote(request: rntme.contracts.crm.v1.ICreateNoteRequest): Promise<rntme.contracts.crm.v1.Note>;

                    /**
                     * Calls DeleteNote.
                     * @param request DeleteNoteRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Note
                     */
                    public deleteNote(request: rntme.contracts.crm.v1.IDeleteNoteRequest, callback: rntme.contracts.crm.v1.CrmModule.DeleteNoteCallback): void;

                    /**
                     * Calls DeleteNote.
                     * @param request DeleteNoteRequest message or plain object
                     * @returns Promise
                     */
                    public deleteNote(request: rntme.contracts.crm.v1.IDeleteNoteRequest): Promise<rntme.contracts.crm.v1.Note>;

                    /**
                     * Calls ListPipelines.
                     * @param request ListPipelinesRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and PipelineList
                     */
                    public listPipelines(request: rntme.contracts.crm.v1.IListPipelinesRequest, callback: rntme.contracts.crm.v1.CrmModule.ListPipelinesCallback): void;

                    /**
                     * Calls ListPipelines.
                     * @param request ListPipelinesRequest message or plain object
                     * @returns Promise
                     */
                    public listPipelines(request: rntme.contracts.crm.v1.IListPipelinesRequest): Promise<rntme.contracts.crm.v1.PipelineList>;

                    /**
                     * Calls ListCustomFieldDefinitions.
                     * @param request ListCustomFieldDefinitionsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and CustomFieldDefinitionList
                     */
                    public listCustomFieldDefinitions(request: rntme.contracts.crm.v1.IListCustomFieldDefinitionsRequest, callback: rntme.contracts.crm.v1.CrmModule.ListCustomFieldDefinitionsCallback): void;

                    /**
                     * Calls ListCustomFieldDefinitions.
                     * @param request ListCustomFieldDefinitionsRequest message or plain object
                     * @returns Promise
                     */
                    public listCustomFieldDefinitions(request: rntme.contracts.crm.v1.IListCustomFieldDefinitionsRequest): Promise<rntme.contracts.crm.v1.CustomFieldDefinitionList>;

                    /**
                     * Calls CreateAssociation.
                     * @param request CreateAssociationRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Association
                     */
                    public createAssociation(request: rntme.contracts.crm.v1.ICreateAssociationRequest, callback: rntme.contracts.crm.v1.CrmModule.CreateAssociationCallback): void;

                    /**
                     * Calls CreateAssociation.
                     * @param request CreateAssociationRequest message or plain object
                     * @returns Promise
                     */
                    public createAssociation(request: rntme.contracts.crm.v1.ICreateAssociationRequest): Promise<rntme.contracts.crm.v1.Association>;

                    /**
                     * Calls DeleteAssociation.
                     * @param request DeleteAssociationRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Association
                     */
                    public deleteAssociation(request: rntme.contracts.crm.v1.IDeleteAssociationRequest, callback: rntme.contracts.crm.v1.CrmModule.DeleteAssociationCallback): void;

                    /**
                     * Calls DeleteAssociation.
                     * @param request DeleteAssociationRequest message or plain object
                     * @returns Promise
                     */
                    public deleteAssociation(request: rntme.contracts.crm.v1.IDeleteAssociationRequest): Promise<rntme.contracts.crm.v1.Association>;

                    /**
                     * Calls ListAssociations.
                     * @param request ListAssociationsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AssociationList
                     */
                    public listAssociations(request: rntme.contracts.crm.v1.IListAssociationsRequest, callback: rntme.contracts.crm.v1.CrmModule.ListAssociationsCallback): void;

                    /**
                     * Calls ListAssociations.
                     * @param request ListAssociationsRequest message or plain object
                     * @returns Promise
                     */
                    public listAssociations(request: rntme.contracts.crm.v1.IListAssociationsRequest): Promise<rntme.contracts.crm.v1.AssociationList>;

                    /**
                     * Calls SyncDelta.
                     * @param request SyncDeltaRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and SyncDeltaResponse
                     */
                    public syncDelta(request: rntme.contracts.crm.v1.ISyncDeltaRequest, callback: rntme.contracts.crm.v1.CrmModule.SyncDeltaCallback): void;

                    /**
                     * Calls SyncDelta.
                     * @param request SyncDeltaRequest message or plain object
                     * @returns Promise
                     */
                    public syncDelta(request: rntme.contracts.crm.v1.ISyncDeltaRequest): Promise<rntme.contracts.crm.v1.SyncDeltaResponse>;

                    /**
                     * Calls SubmitJob.
                     * @param request SubmitJobRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AsyncJob
                     */
                    public submitJob(request: rntme.contracts.crm.v1.ISubmitJobRequest, callback: rntme.contracts.crm.v1.CrmModule.SubmitJobCallback): void;

                    /**
                     * Calls SubmitJob.
                     * @param request SubmitJobRequest message or plain object
                     * @returns Promise
                     */
                    public submitJob(request: rntme.contracts.crm.v1.ISubmitJobRequest): Promise<rntme.contracts.crm.v1.AsyncJob>;

                    /**
                     * Calls GetJob.
                     * @param request GetJobRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AsyncJob
                     */
                    public getJob(request: rntme.contracts.crm.v1.IGetJobRequest, callback: rntme.contracts.crm.v1.CrmModule.GetJobCallback): void;

                    /**
                     * Calls GetJob.
                     * @param request GetJobRequest message or plain object
                     * @returns Promise
                     */
                    public getJob(request: rntme.contracts.crm.v1.IGetJobRequest): Promise<rntme.contracts.crm.v1.AsyncJob>;

                    /**
                     * Calls CancelJob.
                     * @param request CancelJobRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AsyncJob
                     */
                    public cancelJob(request: rntme.contracts.crm.v1.ICancelJobRequest, callback: rntme.contracts.crm.v1.CrmModule.CancelJobCallback): void;

                    /**
                     * Calls CancelJob.
                     * @param request CancelJobRequest message or plain object
                     * @returns Promise
                     */
                    public cancelJob(request: rntme.contracts.crm.v1.ICancelJobRequest): Promise<rntme.contracts.crm.v1.AsyncJob>;

                    /**
                     * Calls ListJobs.
                     * @param request ListJobsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AsyncJobList
                     */
                    public listJobs(request: rntme.contracts.crm.v1.IListJobsRequest, callback: rntme.contracts.crm.v1.CrmModule.ListJobsCallback): void;

                    /**
                     * Calls ListJobs.
                     * @param request ListJobsRequest message or plain object
                     * @returns Promise
                     */
                    public listJobs(request: rntme.contracts.crm.v1.IListJobsRequest): Promise<rntme.contracts.crm.v1.AsyncJobList>;
                }

                namespace CrmModule {

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#getContact}.
                     * @param error Error, if any
                     * @param [response] Contact
                     */
                    type GetContactCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Contact) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#listContacts}.
                     * @param error Error, if any
                     * @param [response] ContactList
                     */
                    type ListContactsCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.ContactList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#createContact}.
                     * @param error Error, if any
                     * @param [response] Contact
                     */
                    type CreateContactCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Contact) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#updateContact}.
                     * @param error Error, if any
                     * @param [response] Contact
                     */
                    type UpdateContactCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Contact) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#deleteContact}.
                     * @param error Error, if any
                     * @param [response] Contact
                     */
                    type DeleteContactCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Contact) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#getCompany}.
                     * @param error Error, if any
                     * @param [response] Company
                     */
                    type GetCompanyCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Company) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#listCompanies}.
                     * @param error Error, if any
                     * @param [response] CompanyList
                     */
                    type ListCompaniesCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.CompanyList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#createCompany}.
                     * @param error Error, if any
                     * @param [response] Company
                     */
                    type CreateCompanyCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Company) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#updateCompany}.
                     * @param error Error, if any
                     * @param [response] Company
                     */
                    type UpdateCompanyCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Company) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#deleteCompany}.
                     * @param error Error, if any
                     * @param [response] Company
                     */
                    type DeleteCompanyCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Company) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#getDeal}.
                     * @param error Error, if any
                     * @param [response] Deal
                     */
                    type GetDealCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Deal) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#listDeals}.
                     * @param error Error, if any
                     * @param [response] DealList
                     */
                    type ListDealsCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.DealList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#createDeal}.
                     * @param error Error, if any
                     * @param [response] Deal
                     */
                    type CreateDealCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Deal) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#updateDeal}.
                     * @param error Error, if any
                     * @param [response] Deal
                     */
                    type UpdateDealCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Deal) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#deleteDeal}.
                     * @param error Error, if any
                     * @param [response] Deal
                     */
                    type DeleteDealCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Deal) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#getActivity}.
                     * @param error Error, if any
                     * @param [response] Activity
                     */
                    type GetActivityCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Activity) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#listActivities}.
                     * @param error Error, if any
                     * @param [response] ActivityList
                     */
                    type ListActivitiesCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.ActivityList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#createActivity}.
                     * @param error Error, if any
                     * @param [response] Activity
                     */
                    type CreateActivityCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Activity) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#updateActivity}.
                     * @param error Error, if any
                     * @param [response] Activity
                     */
                    type UpdateActivityCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Activity) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#deleteActivity}.
                     * @param error Error, if any
                     * @param [response] Activity
                     */
                    type DeleteActivityCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Activity) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#getNote}.
                     * @param error Error, if any
                     * @param [response] Note
                     */
                    type GetNoteCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Note) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#listNotes}.
                     * @param error Error, if any
                     * @param [response] NoteList
                     */
                    type ListNotesCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.NoteList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#createNote}.
                     * @param error Error, if any
                     * @param [response] Note
                     */
                    type CreateNoteCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Note) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#deleteNote}.
                     * @param error Error, if any
                     * @param [response] Note
                     */
                    type DeleteNoteCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Note) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#listPipelines}.
                     * @param error Error, if any
                     * @param [response] PipelineList
                     */
                    type ListPipelinesCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.PipelineList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#listCustomFieldDefinitions}.
                     * @param error Error, if any
                     * @param [response] CustomFieldDefinitionList
                     */
                    type ListCustomFieldDefinitionsCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.CustomFieldDefinitionList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#createAssociation}.
                     * @param error Error, if any
                     * @param [response] Association
                     */
                    type CreateAssociationCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Association) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#deleteAssociation}.
                     * @param error Error, if any
                     * @param [response] Association
                     */
                    type DeleteAssociationCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.Association) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#listAssociations}.
                     * @param error Error, if any
                     * @param [response] AssociationList
                     */
                    type ListAssociationsCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.AssociationList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#syncDelta}.
                     * @param error Error, if any
                     * @param [response] SyncDeltaResponse
                     */
                    type SyncDeltaCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.SyncDeltaResponse) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#submitJob}.
                     * @param error Error, if any
                     * @param [response] AsyncJob
                     */
                    type SubmitJobCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.AsyncJob) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#getJob}.
                     * @param error Error, if any
                     * @param [response] AsyncJob
                     */
                    type GetJobCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.AsyncJob) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#cancelJob}.
                     * @param error Error, if any
                     * @param [response] AsyncJob
                     */
                    type CancelJobCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.AsyncJob) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.crm.v1.CrmModule#listJobs}.
                     * @param error Error, if any
                     * @param [response] AsyncJobList
                     */
                    type ListJobsCallback = (error: (Error|null), response?: rntme.contracts.crm.v1.AsyncJobList) => void;
                }

                /** Properties of a GetContactRequest. */
                interface IGetContactRequest {

                    /** GetContactRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetContactRequest. */
                class GetContactRequest implements IGetContactRequest {

                    /**
                     * Constructs a new GetContactRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IGetContactRequest);

                    /** GetContactRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetContactRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetContactRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IGetContactRequest): rntme.contracts.crm.v1.GetContactRequest;

                    /**
                     * Encodes the specified GetContactRequest message. Does not implicitly {@link rntme.contracts.crm.v1.GetContactRequest.verify|verify} messages.
                     * @param message GetContactRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IGetContactRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetContactRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.GetContactRequest.verify|verify} messages.
                     * @param message GetContactRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IGetContactRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetContactRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetContactRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.GetContactRequest;

                    /**
                     * Decodes a GetContactRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetContactRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.GetContactRequest;

                    /**
                     * Verifies a GetContactRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetContactRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetContactRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.GetContactRequest;

                    /**
                     * Creates a plain object from a GetContactRequest message. Also converts values to other types if specified.
                     * @param message GetContactRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.GetContactRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetContactRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetContactRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListContactsRequest. */
                interface IListContactsRequest {

                    /** ListContactsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListContactsRequest company_canonical_id */
                    company_canonical_id?: (string|null);

                    /** ListContactsRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** ListContactsRequest status */
                    status?: (rntme.contracts.crm.v1.ContactStatus|null);

                    /** ListContactsRequest email */
                    email?: (string|null);
                }

                /** Represents a ListContactsRequest. */
                class ListContactsRequest implements IListContactsRequest {

                    /**
                     * Constructs a new ListContactsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IListContactsRequest);

                    /** ListContactsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListContactsRequest company_canonical_id. */
                    public company_canonical_id: string;

                    /** ListContactsRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** ListContactsRequest status. */
                    public status: rntme.contracts.crm.v1.ContactStatus;

                    /** ListContactsRequest email. */
                    public email: string;

                    /**
                     * Creates a new ListContactsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListContactsRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IListContactsRequest): rntme.contracts.crm.v1.ListContactsRequest;

                    /**
                     * Encodes the specified ListContactsRequest message. Does not implicitly {@link rntme.contracts.crm.v1.ListContactsRequest.verify|verify} messages.
                     * @param message ListContactsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IListContactsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListContactsRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ListContactsRequest.verify|verify} messages.
                     * @param message ListContactsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IListContactsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListContactsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListContactsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ListContactsRequest;

                    /**
                     * Decodes a ListContactsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListContactsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ListContactsRequest;

                    /**
                     * Verifies a ListContactsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListContactsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListContactsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ListContactsRequest;

                    /**
                     * Creates a plain object from a ListContactsRequest message. Also converts values to other types if specified.
                     * @param message ListContactsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ListContactsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListContactsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListContactsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ContactList. */
                interface IContactList {

                    /** ContactList items */
                    items?: (rntme.contracts.crm.v1.IContact[]|null);

                    /** ContactList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents a ContactList. */
                class ContactList implements IContactList {

                    /**
                     * Constructs a new ContactList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IContactList);

                    /** ContactList items. */
                    public items: rntme.contracts.crm.v1.IContact[];

                    /** ContactList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new ContactList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ContactList instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IContactList): rntme.contracts.crm.v1.ContactList;

                    /**
                     * Encodes the specified ContactList message. Does not implicitly {@link rntme.contracts.crm.v1.ContactList.verify|verify} messages.
                     * @param message ContactList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IContactList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ContactList message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ContactList.verify|verify} messages.
                     * @param message ContactList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IContactList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ContactList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ContactList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ContactList;

                    /**
                     * Decodes a ContactList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ContactList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ContactList;

                    /**
                     * Verifies a ContactList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ContactList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ContactList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ContactList;

                    /**
                     * Creates a plain object from a ContactList message. Also converts values to other types if specified.
                     * @param message ContactList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ContactList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ContactList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ContactList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateContactRequest. */
                interface ICreateContactRequest {

                    /** CreateContactRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateContactRequest email */
                    email?: (string|null);

                    /** CreateContactRequest phone */
                    phone?: (string|null);

                    /** CreateContactRequest name */
                    name?: (rntme.contracts.common.v1.IName|null);

                    /** CreateContactRequest title */
                    title?: (string|null);

                    /** CreateContactRequest company_canonical_id */
                    company_canonical_id?: (string|null);

                    /** CreateContactRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** CreateContactRequest tags */
                    tags?: (string[]|null);

                    /** CreateContactRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents a CreateContactRequest. */
                class CreateContactRequest implements ICreateContactRequest {

                    /**
                     * Constructs a new CreateContactRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICreateContactRequest);

                    /** CreateContactRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateContactRequest email. */
                    public email: string;

                    /** CreateContactRequest phone. */
                    public phone: string;

                    /** CreateContactRequest name. */
                    public name?: (rntme.contracts.common.v1.IName|null);

                    /** CreateContactRequest title. */
                    public title: string;

                    /** CreateContactRequest company_canonical_id. */
                    public company_canonical_id: string;

                    /** CreateContactRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** CreateContactRequest tags. */
                    public tags: string[];

                    /** CreateContactRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new CreateContactRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateContactRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICreateContactRequest): rntme.contracts.crm.v1.CreateContactRequest;

                    /**
                     * Encodes the specified CreateContactRequest message. Does not implicitly {@link rntme.contracts.crm.v1.CreateContactRequest.verify|verify} messages.
                     * @param message CreateContactRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICreateContactRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateContactRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CreateContactRequest.verify|verify} messages.
                     * @param message CreateContactRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICreateContactRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateContactRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateContactRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CreateContactRequest;

                    /**
                     * Decodes a CreateContactRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateContactRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CreateContactRequest;

                    /**
                     * Verifies a CreateContactRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateContactRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateContactRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CreateContactRequest;

                    /**
                     * Creates a plain object from a CreateContactRequest message. Also converts values to other types if specified.
                     * @param message CreateContactRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CreateContactRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateContactRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateContactRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateContactRequest. */
                interface IUpdateContactRequest {

                    /** UpdateContactRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateContactRequest canonical_id */
                    canonical_id?: (string|null);

                    /** UpdateContactRequest email */
                    email?: (string|null);

                    /** UpdateContactRequest phone */
                    phone?: (string|null);

                    /** UpdateContactRequest name */
                    name?: (rntme.contracts.common.v1.IName|null);

                    /** UpdateContactRequest title */
                    title?: (string|null);

                    /** UpdateContactRequest company_canonical_id */
                    company_canonical_id?: (string|null);

                    /** UpdateContactRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** UpdateContactRequest tags */
                    tags?: (string[]|null);

                    /** UpdateContactRequest status */
                    status?: (rntme.contracts.crm.v1.ContactStatus|null);

                    /** UpdateContactRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents an UpdateContactRequest. */
                class UpdateContactRequest implements IUpdateContactRequest {

                    /**
                     * Constructs a new UpdateContactRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IUpdateContactRequest);

                    /** UpdateContactRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateContactRequest canonical_id. */
                    public canonical_id: string;

                    /** UpdateContactRequest email. */
                    public email: string;

                    /** UpdateContactRequest phone. */
                    public phone: string;

                    /** UpdateContactRequest name. */
                    public name?: (rntme.contracts.common.v1.IName|null);

                    /** UpdateContactRequest title. */
                    public title: string;

                    /** UpdateContactRequest company_canonical_id. */
                    public company_canonical_id: string;

                    /** UpdateContactRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** UpdateContactRequest tags. */
                    public tags: string[];

                    /** UpdateContactRequest status. */
                    public status: rntme.contracts.crm.v1.ContactStatus;

                    /** UpdateContactRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new UpdateContactRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UpdateContactRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IUpdateContactRequest): rntme.contracts.crm.v1.UpdateContactRequest;

                    /**
                     * Encodes the specified UpdateContactRequest message. Does not implicitly {@link rntme.contracts.crm.v1.UpdateContactRequest.verify|verify} messages.
                     * @param message UpdateContactRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IUpdateContactRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UpdateContactRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.UpdateContactRequest.verify|verify} messages.
                     * @param message UpdateContactRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IUpdateContactRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UpdateContactRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UpdateContactRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.UpdateContactRequest;

                    /**
                     * Decodes an UpdateContactRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UpdateContactRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.UpdateContactRequest;

                    /**
                     * Verifies an UpdateContactRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UpdateContactRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateContactRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.UpdateContactRequest;

                    /**
                     * Creates a plain object from an UpdateContactRequest message. Also converts values to other types if specified.
                     * @param message UpdateContactRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.UpdateContactRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateContactRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateContactRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteContactRequest. */
                interface IDeleteContactRequest {

                    /** DeleteContactRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteContactRequest canonical_id */
                    canonical_id?: (string|null);

                    /** DeleteContactRequest hard_delete */
                    hard_delete?: (boolean|null);
                }

                /** Represents a DeleteContactRequest. */
                class DeleteContactRequest implements IDeleteContactRequest {

                    /**
                     * Constructs a new DeleteContactRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDeleteContactRequest);

                    /** DeleteContactRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteContactRequest canonical_id. */
                    public canonical_id: string;

                    /** DeleteContactRequest hard_delete. */
                    public hard_delete: boolean;

                    /**
                     * Creates a new DeleteContactRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteContactRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDeleteContactRequest): rntme.contracts.crm.v1.DeleteContactRequest;

                    /**
                     * Encodes the specified DeleteContactRequest message. Does not implicitly {@link rntme.contracts.crm.v1.DeleteContactRequest.verify|verify} messages.
                     * @param message DeleteContactRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDeleteContactRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteContactRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DeleteContactRequest.verify|verify} messages.
                     * @param message DeleteContactRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDeleteContactRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteContactRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteContactRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DeleteContactRequest;

                    /**
                     * Decodes a DeleteContactRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteContactRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DeleteContactRequest;

                    /**
                     * Verifies a DeleteContactRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteContactRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteContactRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DeleteContactRequest;

                    /**
                     * Creates a plain object from a DeleteContactRequest message. Also converts values to other types if specified.
                     * @param message DeleteContactRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DeleteContactRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteContactRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteContactRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetCompanyRequest. */
                interface IGetCompanyRequest {

                    /** GetCompanyRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetCompanyRequest. */
                class GetCompanyRequest implements IGetCompanyRequest {

                    /**
                     * Constructs a new GetCompanyRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IGetCompanyRequest);

                    /** GetCompanyRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetCompanyRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetCompanyRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IGetCompanyRequest): rntme.contracts.crm.v1.GetCompanyRequest;

                    /**
                     * Encodes the specified GetCompanyRequest message. Does not implicitly {@link rntme.contracts.crm.v1.GetCompanyRequest.verify|verify} messages.
                     * @param message GetCompanyRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IGetCompanyRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetCompanyRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.GetCompanyRequest.verify|verify} messages.
                     * @param message GetCompanyRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IGetCompanyRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetCompanyRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetCompanyRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.GetCompanyRequest;

                    /**
                     * Decodes a GetCompanyRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetCompanyRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.GetCompanyRequest;

                    /**
                     * Verifies a GetCompanyRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetCompanyRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetCompanyRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.GetCompanyRequest;

                    /**
                     * Creates a plain object from a GetCompanyRequest message. Also converts values to other types if specified.
                     * @param message GetCompanyRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.GetCompanyRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetCompanyRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetCompanyRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListCompaniesRequest. */
                interface IListCompaniesRequest {

                    /** ListCompaniesRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListCompaniesRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** ListCompaniesRequest status */
                    status?: (rntme.contracts.crm.v1.CompanyStatus|null);

                    /** ListCompaniesRequest domain */
                    domain?: (string|null);

                    /** ListCompaniesRequest tax_id */
                    tax_id?: (string|null);
                }

                /** Represents a ListCompaniesRequest. */
                class ListCompaniesRequest implements IListCompaniesRequest {

                    /**
                     * Constructs a new ListCompaniesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IListCompaniesRequest);

                    /** ListCompaniesRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListCompaniesRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** ListCompaniesRequest status. */
                    public status: rntme.contracts.crm.v1.CompanyStatus;

                    /** ListCompaniesRequest domain. */
                    public domain: string;

                    /** ListCompaniesRequest tax_id. */
                    public tax_id: string;

                    /**
                     * Creates a new ListCompaniesRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListCompaniesRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IListCompaniesRequest): rntme.contracts.crm.v1.ListCompaniesRequest;

                    /**
                     * Encodes the specified ListCompaniesRequest message. Does not implicitly {@link rntme.contracts.crm.v1.ListCompaniesRequest.verify|verify} messages.
                     * @param message ListCompaniesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IListCompaniesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListCompaniesRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ListCompaniesRequest.verify|verify} messages.
                     * @param message ListCompaniesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IListCompaniesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListCompaniesRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListCompaniesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ListCompaniesRequest;

                    /**
                     * Decodes a ListCompaniesRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListCompaniesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ListCompaniesRequest;

                    /**
                     * Verifies a ListCompaniesRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListCompaniesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListCompaniesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ListCompaniesRequest;

                    /**
                     * Creates a plain object from a ListCompaniesRequest message. Also converts values to other types if specified.
                     * @param message ListCompaniesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ListCompaniesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListCompaniesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListCompaniesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CompanyList. */
                interface ICompanyList {

                    /** CompanyList items */
                    items?: (rntme.contracts.crm.v1.ICompany[]|null);

                    /** CompanyList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents a CompanyList. */
                class CompanyList implements ICompanyList {

                    /**
                     * Constructs a new CompanyList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICompanyList);

                    /** CompanyList items. */
                    public items: rntme.contracts.crm.v1.ICompany[];

                    /** CompanyList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new CompanyList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CompanyList instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICompanyList): rntme.contracts.crm.v1.CompanyList;

                    /**
                     * Encodes the specified CompanyList message. Does not implicitly {@link rntme.contracts.crm.v1.CompanyList.verify|verify} messages.
                     * @param message CompanyList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICompanyList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CompanyList message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CompanyList.verify|verify} messages.
                     * @param message CompanyList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICompanyList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CompanyList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CompanyList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CompanyList;

                    /**
                     * Decodes a CompanyList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CompanyList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CompanyList;

                    /**
                     * Verifies a CompanyList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CompanyList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CompanyList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CompanyList;

                    /**
                     * Creates a plain object from a CompanyList message. Also converts values to other types if specified.
                     * @param message CompanyList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CompanyList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CompanyList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CompanyList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateCompanyRequest. */
                interface ICreateCompanyRequest {

                    /** CreateCompanyRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateCompanyRequest name */
                    name?: (string|null);

                    /** CreateCompanyRequest domain */
                    domain?: (string|null);

                    /** CreateCompanyRequest industry */
                    industry?: (string|null);

                    /** CreateCompanyRequest employee_count */
                    employee_count?: (number|null);

                    /** CreateCompanyRequest annual_revenue */
                    annual_revenue?: (number|null);

                    /** CreateCompanyRequest currency */
                    currency?: (string|null);

                    /** CreateCompanyRequest tax_id */
                    tax_id?: (string|null);

                    /** CreateCompanyRequest registration_id */
                    registration_id?: (string|null);

                    /** CreateCompanyRequest tax_branch_id */
                    tax_branch_id?: (string|null);

                    /** CreateCompanyRequest parent_company_canonical_id */
                    parent_company_canonical_id?: (string|null);

                    /** CreateCompanyRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** CreateCompanyRequest tags */
                    tags?: (string[]|null);

                    /** CreateCompanyRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents a CreateCompanyRequest. */
                class CreateCompanyRequest implements ICreateCompanyRequest {

                    /**
                     * Constructs a new CreateCompanyRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICreateCompanyRequest);

                    /** CreateCompanyRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateCompanyRequest name. */
                    public name: string;

                    /** CreateCompanyRequest domain. */
                    public domain: string;

                    /** CreateCompanyRequest industry. */
                    public industry: string;

                    /** CreateCompanyRequest employee_count. */
                    public employee_count: number;

                    /** CreateCompanyRequest annual_revenue. */
                    public annual_revenue: number;

                    /** CreateCompanyRequest currency. */
                    public currency: string;

                    /** CreateCompanyRequest tax_id. */
                    public tax_id: string;

                    /** CreateCompanyRequest registration_id. */
                    public registration_id: string;

                    /** CreateCompanyRequest tax_branch_id. */
                    public tax_branch_id: string;

                    /** CreateCompanyRequest parent_company_canonical_id. */
                    public parent_company_canonical_id: string;

                    /** CreateCompanyRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** CreateCompanyRequest tags. */
                    public tags: string[];

                    /** CreateCompanyRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new CreateCompanyRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateCompanyRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICreateCompanyRequest): rntme.contracts.crm.v1.CreateCompanyRequest;

                    /**
                     * Encodes the specified CreateCompanyRequest message. Does not implicitly {@link rntme.contracts.crm.v1.CreateCompanyRequest.verify|verify} messages.
                     * @param message CreateCompanyRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICreateCompanyRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateCompanyRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CreateCompanyRequest.verify|verify} messages.
                     * @param message CreateCompanyRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICreateCompanyRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateCompanyRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateCompanyRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CreateCompanyRequest;

                    /**
                     * Decodes a CreateCompanyRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateCompanyRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CreateCompanyRequest;

                    /**
                     * Verifies a CreateCompanyRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateCompanyRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateCompanyRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CreateCompanyRequest;

                    /**
                     * Creates a plain object from a CreateCompanyRequest message. Also converts values to other types if specified.
                     * @param message CreateCompanyRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CreateCompanyRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateCompanyRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateCompanyRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateCompanyRequest. */
                interface IUpdateCompanyRequest {

                    /** UpdateCompanyRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateCompanyRequest canonical_id */
                    canonical_id?: (string|null);

                    /** UpdateCompanyRequest name */
                    name?: (string|null);

                    /** UpdateCompanyRequest domain */
                    domain?: (string|null);

                    /** UpdateCompanyRequest industry */
                    industry?: (string|null);

                    /** UpdateCompanyRequest employee_count */
                    employee_count?: (number|null);

                    /** UpdateCompanyRequest annual_revenue */
                    annual_revenue?: (number|null);

                    /** UpdateCompanyRequest currency */
                    currency?: (string|null);

                    /** UpdateCompanyRequest tax_id */
                    tax_id?: (string|null);

                    /** UpdateCompanyRequest registration_id */
                    registration_id?: (string|null);

                    /** UpdateCompanyRequest tax_branch_id */
                    tax_branch_id?: (string|null);

                    /** UpdateCompanyRequest parent_company_canonical_id */
                    parent_company_canonical_id?: (string|null);

                    /** UpdateCompanyRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** UpdateCompanyRequest tags */
                    tags?: (string[]|null);

                    /** UpdateCompanyRequest status */
                    status?: (rntme.contracts.crm.v1.CompanyStatus|null);

                    /** UpdateCompanyRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents an UpdateCompanyRequest. */
                class UpdateCompanyRequest implements IUpdateCompanyRequest {

                    /**
                     * Constructs a new UpdateCompanyRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IUpdateCompanyRequest);

                    /** UpdateCompanyRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateCompanyRequest canonical_id. */
                    public canonical_id: string;

                    /** UpdateCompanyRequest name. */
                    public name: string;

                    /** UpdateCompanyRequest domain. */
                    public domain: string;

                    /** UpdateCompanyRequest industry. */
                    public industry: string;

                    /** UpdateCompanyRequest employee_count. */
                    public employee_count: number;

                    /** UpdateCompanyRequest annual_revenue. */
                    public annual_revenue: number;

                    /** UpdateCompanyRequest currency. */
                    public currency: string;

                    /** UpdateCompanyRequest tax_id. */
                    public tax_id: string;

                    /** UpdateCompanyRequest registration_id. */
                    public registration_id: string;

                    /** UpdateCompanyRequest tax_branch_id. */
                    public tax_branch_id: string;

                    /** UpdateCompanyRequest parent_company_canonical_id. */
                    public parent_company_canonical_id: string;

                    /** UpdateCompanyRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** UpdateCompanyRequest tags. */
                    public tags: string[];

                    /** UpdateCompanyRequest status. */
                    public status: rntme.contracts.crm.v1.CompanyStatus;

                    /** UpdateCompanyRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new UpdateCompanyRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UpdateCompanyRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IUpdateCompanyRequest): rntme.contracts.crm.v1.UpdateCompanyRequest;

                    /**
                     * Encodes the specified UpdateCompanyRequest message. Does not implicitly {@link rntme.contracts.crm.v1.UpdateCompanyRequest.verify|verify} messages.
                     * @param message UpdateCompanyRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IUpdateCompanyRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UpdateCompanyRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.UpdateCompanyRequest.verify|verify} messages.
                     * @param message UpdateCompanyRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IUpdateCompanyRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UpdateCompanyRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UpdateCompanyRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.UpdateCompanyRequest;

                    /**
                     * Decodes an UpdateCompanyRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UpdateCompanyRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.UpdateCompanyRequest;

                    /**
                     * Verifies an UpdateCompanyRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UpdateCompanyRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateCompanyRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.UpdateCompanyRequest;

                    /**
                     * Creates a plain object from an UpdateCompanyRequest message. Also converts values to other types if specified.
                     * @param message UpdateCompanyRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.UpdateCompanyRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateCompanyRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateCompanyRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteCompanyRequest. */
                interface IDeleteCompanyRequest {

                    /** DeleteCompanyRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteCompanyRequest canonical_id */
                    canonical_id?: (string|null);

                    /** DeleteCompanyRequest hard_delete */
                    hard_delete?: (boolean|null);
                }

                /** Represents a DeleteCompanyRequest. */
                class DeleteCompanyRequest implements IDeleteCompanyRequest {

                    /**
                     * Constructs a new DeleteCompanyRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDeleteCompanyRequest);

                    /** DeleteCompanyRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteCompanyRequest canonical_id. */
                    public canonical_id: string;

                    /** DeleteCompanyRequest hard_delete. */
                    public hard_delete: boolean;

                    /**
                     * Creates a new DeleteCompanyRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteCompanyRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDeleteCompanyRequest): rntme.contracts.crm.v1.DeleteCompanyRequest;

                    /**
                     * Encodes the specified DeleteCompanyRequest message. Does not implicitly {@link rntme.contracts.crm.v1.DeleteCompanyRequest.verify|verify} messages.
                     * @param message DeleteCompanyRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDeleteCompanyRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteCompanyRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DeleteCompanyRequest.verify|verify} messages.
                     * @param message DeleteCompanyRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDeleteCompanyRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteCompanyRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteCompanyRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DeleteCompanyRequest;

                    /**
                     * Decodes a DeleteCompanyRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteCompanyRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DeleteCompanyRequest;

                    /**
                     * Verifies a DeleteCompanyRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteCompanyRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteCompanyRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DeleteCompanyRequest;

                    /**
                     * Creates a plain object from a DeleteCompanyRequest message. Also converts values to other types if specified.
                     * @param message DeleteCompanyRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DeleteCompanyRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteCompanyRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteCompanyRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetDealRequest. */
                interface IGetDealRequest {

                    /** GetDealRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetDealRequest. */
                class GetDealRequest implements IGetDealRequest {

                    /**
                     * Constructs a new GetDealRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IGetDealRequest);

                    /** GetDealRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetDealRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetDealRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IGetDealRequest): rntme.contracts.crm.v1.GetDealRequest;

                    /**
                     * Encodes the specified GetDealRequest message. Does not implicitly {@link rntme.contracts.crm.v1.GetDealRequest.verify|verify} messages.
                     * @param message GetDealRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IGetDealRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetDealRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.GetDealRequest.verify|verify} messages.
                     * @param message GetDealRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IGetDealRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetDealRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetDealRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.GetDealRequest;

                    /**
                     * Decodes a GetDealRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetDealRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.GetDealRequest;

                    /**
                     * Verifies a GetDealRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetDealRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetDealRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.GetDealRequest;

                    /**
                     * Creates a plain object from a GetDealRequest message. Also converts values to other types if specified.
                     * @param message GetDealRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.GetDealRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetDealRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetDealRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListDealsRequest. */
                interface IListDealsRequest {

                    /** ListDealsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListDealsRequest pipeline_canonical_id */
                    pipeline_canonical_id?: (string|null);

                    /** ListDealsRequest stage_canonical_id */
                    stage_canonical_id?: (string|null);

                    /** ListDealsRequest company_canonical_id */
                    company_canonical_id?: (string|null);

                    /** ListDealsRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** ListDealsRequest status */
                    status?: (rntme.contracts.crm.v1.DealStatus|null);

                    /** ListDealsRequest qualification */
                    qualification?: (rntme.contracts.crm.v1.DealQualification|null);
                }

                /** Represents a ListDealsRequest. */
                class ListDealsRequest implements IListDealsRequest {

                    /**
                     * Constructs a new ListDealsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IListDealsRequest);

                    /** ListDealsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListDealsRequest pipeline_canonical_id. */
                    public pipeline_canonical_id: string;

                    /** ListDealsRequest stage_canonical_id. */
                    public stage_canonical_id: string;

                    /** ListDealsRequest company_canonical_id. */
                    public company_canonical_id: string;

                    /** ListDealsRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** ListDealsRequest status. */
                    public status: rntme.contracts.crm.v1.DealStatus;

                    /** ListDealsRequest qualification. */
                    public qualification: rntme.contracts.crm.v1.DealQualification;

                    /**
                     * Creates a new ListDealsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListDealsRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IListDealsRequest): rntme.contracts.crm.v1.ListDealsRequest;

                    /**
                     * Encodes the specified ListDealsRequest message. Does not implicitly {@link rntme.contracts.crm.v1.ListDealsRequest.verify|verify} messages.
                     * @param message ListDealsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IListDealsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListDealsRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ListDealsRequest.verify|verify} messages.
                     * @param message ListDealsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IListDealsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListDealsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListDealsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ListDealsRequest;

                    /**
                     * Decodes a ListDealsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListDealsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ListDealsRequest;

                    /**
                     * Verifies a ListDealsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListDealsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListDealsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ListDealsRequest;

                    /**
                     * Creates a plain object from a ListDealsRequest message. Also converts values to other types if specified.
                     * @param message ListDealsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ListDealsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListDealsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListDealsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DealList. */
                interface IDealList {

                    /** DealList items */
                    items?: (rntme.contracts.crm.v1.IDeal[]|null);

                    /** DealList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents a DealList. */
                class DealList implements IDealList {

                    /**
                     * Constructs a new DealList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDealList);

                    /** DealList items. */
                    public items: rntme.contracts.crm.v1.IDeal[];

                    /** DealList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new DealList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DealList instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDealList): rntme.contracts.crm.v1.DealList;

                    /**
                     * Encodes the specified DealList message. Does not implicitly {@link rntme.contracts.crm.v1.DealList.verify|verify} messages.
                     * @param message DealList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDealList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DealList message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DealList.verify|verify} messages.
                     * @param message DealList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDealList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DealList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DealList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DealList;

                    /**
                     * Decodes a DealList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DealList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DealList;

                    /**
                     * Verifies a DealList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DealList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DealList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DealList;

                    /**
                     * Creates a plain object from a DealList message. Also converts values to other types if specified.
                     * @param message DealList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DealList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DealList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DealList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateDealRequest. */
                interface ICreateDealRequest {

                    /** CreateDealRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateDealRequest name */
                    name?: (string|null);

                    /** CreateDealRequest pipeline_canonical_id */
                    pipeline_canonical_id?: (string|null);

                    /** CreateDealRequest stage_canonical_id */
                    stage_canonical_id?: (string|null);

                    /** CreateDealRequest qualification */
                    qualification?: (rntme.contracts.crm.v1.DealQualification|null);

                    /** CreateDealRequest amount */
                    amount?: (number|null);

                    /** CreateDealRequest currency */
                    currency?: (string|null);

                    /** CreateDealRequest expected_close_date */
                    expected_close_date?: (google.protobuf.ITimestamp|null);

                    /** CreateDealRequest primary_contact_canonical_id */
                    primary_contact_canonical_id?: (string|null);

                    /** CreateDealRequest company_canonical_id */
                    company_canonical_id?: (string|null);

                    /** CreateDealRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** CreateDealRequest tags */
                    tags?: (string[]|null);

                    /** CreateDealRequest source */
                    source?: (string|null);

                    /** CreateDealRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents a CreateDealRequest. */
                class CreateDealRequest implements ICreateDealRequest {

                    /**
                     * Constructs a new CreateDealRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICreateDealRequest);

                    /** CreateDealRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateDealRequest name. */
                    public name: string;

                    /** CreateDealRequest pipeline_canonical_id. */
                    public pipeline_canonical_id: string;

                    /** CreateDealRequest stage_canonical_id. */
                    public stage_canonical_id: string;

                    /** CreateDealRequest qualification. */
                    public qualification: rntme.contracts.crm.v1.DealQualification;

                    /** CreateDealRequest amount. */
                    public amount: number;

                    /** CreateDealRequest currency. */
                    public currency: string;

                    /** CreateDealRequest expected_close_date. */
                    public expected_close_date?: (google.protobuf.ITimestamp|null);

                    /** CreateDealRequest primary_contact_canonical_id. */
                    public primary_contact_canonical_id: string;

                    /** CreateDealRequest company_canonical_id. */
                    public company_canonical_id: string;

                    /** CreateDealRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** CreateDealRequest tags. */
                    public tags: string[];

                    /** CreateDealRequest source. */
                    public source: string;

                    /** CreateDealRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new CreateDealRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateDealRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICreateDealRequest): rntme.contracts.crm.v1.CreateDealRequest;

                    /**
                     * Encodes the specified CreateDealRequest message. Does not implicitly {@link rntme.contracts.crm.v1.CreateDealRequest.verify|verify} messages.
                     * @param message CreateDealRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICreateDealRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateDealRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CreateDealRequest.verify|verify} messages.
                     * @param message CreateDealRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICreateDealRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateDealRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateDealRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CreateDealRequest;

                    /**
                     * Decodes a CreateDealRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateDealRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CreateDealRequest;

                    /**
                     * Verifies a CreateDealRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateDealRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateDealRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CreateDealRequest;

                    /**
                     * Creates a plain object from a CreateDealRequest message. Also converts values to other types if specified.
                     * @param message CreateDealRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CreateDealRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateDealRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateDealRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateDealRequest. */
                interface IUpdateDealRequest {

                    /** UpdateDealRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateDealRequest canonical_id */
                    canonical_id?: (string|null);

                    /** UpdateDealRequest name */
                    name?: (string|null);

                    /** UpdateDealRequest pipeline_canonical_id */
                    pipeline_canonical_id?: (string|null);

                    /** UpdateDealRequest stage_canonical_id */
                    stage_canonical_id?: (string|null);

                    /** UpdateDealRequest status */
                    status?: (rntme.contracts.crm.v1.DealStatus|null);

                    /** UpdateDealRequest qualification */
                    qualification?: (rntme.contracts.crm.v1.DealQualification|null);

                    /** UpdateDealRequest amount */
                    amount?: (number|null);

                    /** UpdateDealRequest currency */
                    currency?: (string|null);

                    /** UpdateDealRequest expected_close_date */
                    expected_close_date?: (google.protobuf.ITimestamp|null);

                    /** UpdateDealRequest close_reason */
                    close_reason?: (string|null);

                    /** UpdateDealRequest primary_contact_canonical_id */
                    primary_contact_canonical_id?: (string|null);

                    /** UpdateDealRequest company_canonical_id */
                    company_canonical_id?: (string|null);

                    /** UpdateDealRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** UpdateDealRequest tags */
                    tags?: (string[]|null);

                    /** UpdateDealRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents an UpdateDealRequest. */
                class UpdateDealRequest implements IUpdateDealRequest {

                    /**
                     * Constructs a new UpdateDealRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IUpdateDealRequest);

                    /** UpdateDealRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateDealRequest canonical_id. */
                    public canonical_id: string;

                    /** UpdateDealRequest name. */
                    public name: string;

                    /** UpdateDealRequest pipeline_canonical_id. */
                    public pipeline_canonical_id: string;

                    /** UpdateDealRequest stage_canonical_id. */
                    public stage_canonical_id: string;

                    /** UpdateDealRequest status. */
                    public status: rntme.contracts.crm.v1.DealStatus;

                    /** UpdateDealRequest qualification. */
                    public qualification: rntme.contracts.crm.v1.DealQualification;

                    /** UpdateDealRequest amount. */
                    public amount: number;

                    /** UpdateDealRequest currency. */
                    public currency: string;

                    /** UpdateDealRequest expected_close_date. */
                    public expected_close_date?: (google.protobuf.ITimestamp|null);

                    /** UpdateDealRequest close_reason. */
                    public close_reason: string;

                    /** UpdateDealRequest primary_contact_canonical_id. */
                    public primary_contact_canonical_id: string;

                    /** UpdateDealRequest company_canonical_id. */
                    public company_canonical_id: string;

                    /** UpdateDealRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** UpdateDealRequest tags. */
                    public tags: string[];

                    /** UpdateDealRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new UpdateDealRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UpdateDealRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IUpdateDealRequest): rntme.contracts.crm.v1.UpdateDealRequest;

                    /**
                     * Encodes the specified UpdateDealRequest message. Does not implicitly {@link rntme.contracts.crm.v1.UpdateDealRequest.verify|verify} messages.
                     * @param message UpdateDealRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IUpdateDealRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UpdateDealRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.UpdateDealRequest.verify|verify} messages.
                     * @param message UpdateDealRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IUpdateDealRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UpdateDealRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UpdateDealRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.UpdateDealRequest;

                    /**
                     * Decodes an UpdateDealRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UpdateDealRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.UpdateDealRequest;

                    /**
                     * Verifies an UpdateDealRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UpdateDealRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateDealRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.UpdateDealRequest;

                    /**
                     * Creates a plain object from an UpdateDealRequest message. Also converts values to other types if specified.
                     * @param message UpdateDealRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.UpdateDealRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateDealRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateDealRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteDealRequest. */
                interface IDeleteDealRequest {

                    /** DeleteDealRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteDealRequest canonical_id */
                    canonical_id?: (string|null);

                    /** DeleteDealRequest hard_delete */
                    hard_delete?: (boolean|null);
                }

                /** Represents a DeleteDealRequest. */
                class DeleteDealRequest implements IDeleteDealRequest {

                    /**
                     * Constructs a new DeleteDealRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDeleteDealRequest);

                    /** DeleteDealRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteDealRequest canonical_id. */
                    public canonical_id: string;

                    /** DeleteDealRequest hard_delete. */
                    public hard_delete: boolean;

                    /**
                     * Creates a new DeleteDealRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteDealRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDeleteDealRequest): rntme.contracts.crm.v1.DeleteDealRequest;

                    /**
                     * Encodes the specified DeleteDealRequest message. Does not implicitly {@link rntme.contracts.crm.v1.DeleteDealRequest.verify|verify} messages.
                     * @param message DeleteDealRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDeleteDealRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteDealRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DeleteDealRequest.verify|verify} messages.
                     * @param message DeleteDealRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDeleteDealRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteDealRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteDealRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DeleteDealRequest;

                    /**
                     * Decodes a DeleteDealRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteDealRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DeleteDealRequest;

                    /**
                     * Verifies a DeleteDealRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteDealRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteDealRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DeleteDealRequest;

                    /**
                     * Creates a plain object from a DeleteDealRequest message. Also converts values to other types if specified.
                     * @param message DeleteDealRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DeleteDealRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteDealRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteDealRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetActivityRequest. */
                interface IGetActivityRequest {

                    /** GetActivityRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetActivityRequest. */
                class GetActivityRequest implements IGetActivityRequest {

                    /**
                     * Constructs a new GetActivityRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IGetActivityRequest);

                    /** GetActivityRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetActivityRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetActivityRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IGetActivityRequest): rntme.contracts.crm.v1.GetActivityRequest;

                    /**
                     * Encodes the specified GetActivityRequest message. Does not implicitly {@link rntme.contracts.crm.v1.GetActivityRequest.verify|verify} messages.
                     * @param message GetActivityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IGetActivityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetActivityRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.GetActivityRequest.verify|verify} messages.
                     * @param message GetActivityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IGetActivityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetActivityRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetActivityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.GetActivityRequest;

                    /**
                     * Decodes a GetActivityRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetActivityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.GetActivityRequest;

                    /**
                     * Verifies a GetActivityRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetActivityRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetActivityRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.GetActivityRequest;

                    /**
                     * Creates a plain object from a GetActivityRequest message. Also converts values to other types if specified.
                     * @param message GetActivityRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.GetActivityRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetActivityRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetActivityRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListActivitiesRequest. */
                interface IListActivitiesRequest {

                    /** ListActivitiesRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListActivitiesRequest linked_to */
                    linked_to?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** ListActivitiesRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** ListActivitiesRequest type */
                    type?: (rntme.contracts.crm.v1.ActivityType|null);

                    /** ListActivitiesRequest outcome */
                    outcome?: (rntme.contracts.crm.v1.ActivityOutcome|null);

                    /** ListActivitiesRequest is_completed */
                    is_completed?: (boolean|null);
                }

                /** Represents a ListActivitiesRequest. */
                class ListActivitiesRequest implements IListActivitiesRequest {

                    /**
                     * Constructs a new ListActivitiesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IListActivitiesRequest);

                    /** ListActivitiesRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListActivitiesRequest linked_to. */
                    public linked_to?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** ListActivitiesRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** ListActivitiesRequest type. */
                    public type: rntme.contracts.crm.v1.ActivityType;

                    /** ListActivitiesRequest outcome. */
                    public outcome: rntme.contracts.crm.v1.ActivityOutcome;

                    /** ListActivitiesRequest is_completed. */
                    public is_completed: boolean;

                    /**
                     * Creates a new ListActivitiesRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListActivitiesRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IListActivitiesRequest): rntme.contracts.crm.v1.ListActivitiesRequest;

                    /**
                     * Encodes the specified ListActivitiesRequest message. Does not implicitly {@link rntme.contracts.crm.v1.ListActivitiesRequest.verify|verify} messages.
                     * @param message ListActivitiesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IListActivitiesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListActivitiesRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ListActivitiesRequest.verify|verify} messages.
                     * @param message ListActivitiesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IListActivitiesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListActivitiesRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListActivitiesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ListActivitiesRequest;

                    /**
                     * Decodes a ListActivitiesRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListActivitiesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ListActivitiesRequest;

                    /**
                     * Verifies a ListActivitiesRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListActivitiesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListActivitiesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ListActivitiesRequest;

                    /**
                     * Creates a plain object from a ListActivitiesRequest message. Also converts values to other types if specified.
                     * @param message ListActivitiesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ListActivitiesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListActivitiesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListActivitiesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ActivityList. */
                interface IActivityList {

                    /** ActivityList items */
                    items?: (rntme.contracts.crm.v1.IActivity[]|null);

                    /** ActivityList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents an ActivityList. */
                class ActivityList implements IActivityList {

                    /**
                     * Constructs a new ActivityList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IActivityList);

                    /** ActivityList items. */
                    public items: rntme.contracts.crm.v1.IActivity[];

                    /** ActivityList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new ActivityList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ActivityList instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IActivityList): rntme.contracts.crm.v1.ActivityList;

                    /**
                     * Encodes the specified ActivityList message. Does not implicitly {@link rntme.contracts.crm.v1.ActivityList.verify|verify} messages.
                     * @param message ActivityList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IActivityList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ActivityList message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ActivityList.verify|verify} messages.
                     * @param message ActivityList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IActivityList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an ActivityList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ActivityList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ActivityList;

                    /**
                     * Decodes an ActivityList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ActivityList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ActivityList;

                    /**
                     * Verifies an ActivityList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an ActivityList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ActivityList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ActivityList;

                    /**
                     * Creates a plain object from an ActivityList message. Also converts values to other types if specified.
                     * @param message ActivityList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ActivityList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ActivityList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ActivityList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateActivityRequest. */
                interface ICreateActivityRequest {

                    /** CreateActivityRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateActivityRequest type */
                    type?: (rntme.contracts.crm.v1.ActivityType|null);

                    /** CreateActivityRequest subject */
                    subject?: (string|null);

                    /** CreateActivityRequest description */
                    description?: (string|null);

                    /** CreateActivityRequest due_at */
                    due_at?: (google.protobuf.ITimestamp|null);

                    /** CreateActivityRequest duration */
                    duration?: (google.protobuf.IDuration|null);

                    /** CreateActivityRequest linked_entities */
                    linked_entities?: (rntme.contracts.crm.v1.IEntityRef[]|null);

                    /** CreateActivityRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** CreateActivityRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents a CreateActivityRequest. */
                class CreateActivityRequest implements ICreateActivityRequest {

                    /**
                     * Constructs a new CreateActivityRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICreateActivityRequest);

                    /** CreateActivityRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateActivityRequest type. */
                    public type: rntme.contracts.crm.v1.ActivityType;

                    /** CreateActivityRequest subject. */
                    public subject: string;

                    /** CreateActivityRequest description. */
                    public description: string;

                    /** CreateActivityRequest due_at. */
                    public due_at?: (google.protobuf.ITimestamp|null);

                    /** CreateActivityRequest duration. */
                    public duration?: (google.protobuf.IDuration|null);

                    /** CreateActivityRequest linked_entities. */
                    public linked_entities: rntme.contracts.crm.v1.IEntityRef[];

                    /** CreateActivityRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** CreateActivityRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new CreateActivityRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateActivityRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICreateActivityRequest): rntme.contracts.crm.v1.CreateActivityRequest;

                    /**
                     * Encodes the specified CreateActivityRequest message. Does not implicitly {@link rntme.contracts.crm.v1.CreateActivityRequest.verify|verify} messages.
                     * @param message CreateActivityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICreateActivityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateActivityRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CreateActivityRequest.verify|verify} messages.
                     * @param message CreateActivityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICreateActivityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateActivityRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateActivityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CreateActivityRequest;

                    /**
                     * Decodes a CreateActivityRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateActivityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CreateActivityRequest;

                    /**
                     * Verifies a CreateActivityRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateActivityRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateActivityRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CreateActivityRequest;

                    /**
                     * Creates a plain object from a CreateActivityRequest message. Also converts values to other types if specified.
                     * @param message CreateActivityRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CreateActivityRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateActivityRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateActivityRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UpdateActivityRequest. */
                interface IUpdateActivityRequest {

                    /** UpdateActivityRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateActivityRequest canonical_id */
                    canonical_id?: (string|null);

                    /** UpdateActivityRequest subject */
                    subject?: (string|null);

                    /** UpdateActivityRequest description */
                    description?: (string|null);

                    /** UpdateActivityRequest due_at */
                    due_at?: (google.protobuf.ITimestamp|null);

                    /** UpdateActivityRequest completed_at */
                    completed_at?: (google.protobuf.ITimestamp|null);

                    /** UpdateActivityRequest duration */
                    duration?: (google.protobuf.IDuration|null);

                    /** UpdateActivityRequest outcome */
                    outcome?: (rntme.contracts.crm.v1.ActivityOutcome|null);

                    /** UpdateActivityRequest linked_entities */
                    linked_entities?: (rntme.contracts.crm.v1.IEntityRef[]|null);

                    /** UpdateActivityRequest owner_canonical_id */
                    owner_canonical_id?: (string|null);

                    /** UpdateActivityRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents an UpdateActivityRequest. */
                class UpdateActivityRequest implements IUpdateActivityRequest {

                    /**
                     * Constructs a new UpdateActivityRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IUpdateActivityRequest);

                    /** UpdateActivityRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** UpdateActivityRequest canonical_id. */
                    public canonical_id: string;

                    /** UpdateActivityRequest subject. */
                    public subject: string;

                    /** UpdateActivityRequest description. */
                    public description: string;

                    /** UpdateActivityRequest due_at. */
                    public due_at?: (google.protobuf.ITimestamp|null);

                    /** UpdateActivityRequest completed_at. */
                    public completed_at?: (google.protobuf.ITimestamp|null);

                    /** UpdateActivityRequest duration. */
                    public duration?: (google.protobuf.IDuration|null);

                    /** UpdateActivityRequest outcome. */
                    public outcome: rntme.contracts.crm.v1.ActivityOutcome;

                    /** UpdateActivityRequest linked_entities. */
                    public linked_entities: rntme.contracts.crm.v1.IEntityRef[];

                    /** UpdateActivityRequest owner_canonical_id. */
                    public owner_canonical_id: string;

                    /** UpdateActivityRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new UpdateActivityRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UpdateActivityRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IUpdateActivityRequest): rntme.contracts.crm.v1.UpdateActivityRequest;

                    /**
                     * Encodes the specified UpdateActivityRequest message. Does not implicitly {@link rntme.contracts.crm.v1.UpdateActivityRequest.verify|verify} messages.
                     * @param message UpdateActivityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IUpdateActivityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UpdateActivityRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.UpdateActivityRequest.verify|verify} messages.
                     * @param message UpdateActivityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IUpdateActivityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UpdateActivityRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UpdateActivityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.UpdateActivityRequest;

                    /**
                     * Decodes an UpdateActivityRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UpdateActivityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.UpdateActivityRequest;

                    /**
                     * Verifies an UpdateActivityRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UpdateActivityRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UpdateActivityRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.UpdateActivityRequest;

                    /**
                     * Creates a plain object from an UpdateActivityRequest message. Also converts values to other types if specified.
                     * @param message UpdateActivityRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.UpdateActivityRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UpdateActivityRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UpdateActivityRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteActivityRequest. */
                interface IDeleteActivityRequest {

                    /** DeleteActivityRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteActivityRequest canonical_id */
                    canonical_id?: (string|null);

                    /** DeleteActivityRequest hard_delete */
                    hard_delete?: (boolean|null);
                }

                /** Represents a DeleteActivityRequest. */
                class DeleteActivityRequest implements IDeleteActivityRequest {

                    /**
                     * Constructs a new DeleteActivityRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDeleteActivityRequest);

                    /** DeleteActivityRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteActivityRequest canonical_id. */
                    public canonical_id: string;

                    /** DeleteActivityRequest hard_delete. */
                    public hard_delete: boolean;

                    /**
                     * Creates a new DeleteActivityRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteActivityRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDeleteActivityRequest): rntme.contracts.crm.v1.DeleteActivityRequest;

                    /**
                     * Encodes the specified DeleteActivityRequest message. Does not implicitly {@link rntme.contracts.crm.v1.DeleteActivityRequest.verify|verify} messages.
                     * @param message DeleteActivityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDeleteActivityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteActivityRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DeleteActivityRequest.verify|verify} messages.
                     * @param message DeleteActivityRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDeleteActivityRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteActivityRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteActivityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DeleteActivityRequest;

                    /**
                     * Decodes a DeleteActivityRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteActivityRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DeleteActivityRequest;

                    /**
                     * Verifies a DeleteActivityRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteActivityRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteActivityRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DeleteActivityRequest;

                    /**
                     * Creates a plain object from a DeleteActivityRequest message. Also converts values to other types if specified.
                     * @param message DeleteActivityRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DeleteActivityRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteActivityRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteActivityRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetNoteRequest. */
                interface IGetNoteRequest {

                    /** GetNoteRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetNoteRequest. */
                class GetNoteRequest implements IGetNoteRequest {

                    /**
                     * Constructs a new GetNoteRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IGetNoteRequest);

                    /** GetNoteRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetNoteRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetNoteRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IGetNoteRequest): rntme.contracts.crm.v1.GetNoteRequest;

                    /**
                     * Encodes the specified GetNoteRequest message. Does not implicitly {@link rntme.contracts.crm.v1.GetNoteRequest.verify|verify} messages.
                     * @param message GetNoteRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IGetNoteRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetNoteRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.GetNoteRequest.verify|verify} messages.
                     * @param message GetNoteRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IGetNoteRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetNoteRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetNoteRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.GetNoteRequest;

                    /**
                     * Decodes a GetNoteRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetNoteRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.GetNoteRequest;

                    /**
                     * Verifies a GetNoteRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetNoteRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetNoteRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.GetNoteRequest;

                    /**
                     * Creates a plain object from a GetNoteRequest message. Also converts values to other types if specified.
                     * @param message GetNoteRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.GetNoteRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetNoteRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetNoteRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListNotesRequest. */
                interface IListNotesRequest {

                    /** ListNotesRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListNotesRequest parent */
                    parent?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** ListNotesRequest author_canonical_id */
                    author_canonical_id?: (string|null);
                }

                /** Represents a ListNotesRequest. */
                class ListNotesRequest implements IListNotesRequest {

                    /**
                     * Constructs a new ListNotesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IListNotesRequest);

                    /** ListNotesRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListNotesRequest parent. */
                    public parent?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** ListNotesRequest author_canonical_id. */
                    public author_canonical_id: string;

                    /**
                     * Creates a new ListNotesRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListNotesRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IListNotesRequest): rntme.contracts.crm.v1.ListNotesRequest;

                    /**
                     * Encodes the specified ListNotesRequest message. Does not implicitly {@link rntme.contracts.crm.v1.ListNotesRequest.verify|verify} messages.
                     * @param message ListNotesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IListNotesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListNotesRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ListNotesRequest.verify|verify} messages.
                     * @param message ListNotesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IListNotesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListNotesRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListNotesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ListNotesRequest;

                    /**
                     * Decodes a ListNotesRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListNotesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ListNotesRequest;

                    /**
                     * Verifies a ListNotesRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListNotesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListNotesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ListNotesRequest;

                    /**
                     * Creates a plain object from a ListNotesRequest message. Also converts values to other types if specified.
                     * @param message ListNotesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ListNotesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListNotesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListNotesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a NoteList. */
                interface INoteList {

                    /** NoteList items */
                    items?: (rntme.contracts.crm.v1.INote[]|null);

                    /** NoteList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents a NoteList. */
                class NoteList implements INoteList {

                    /**
                     * Constructs a new NoteList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.INoteList);

                    /** NoteList items. */
                    public items: rntme.contracts.crm.v1.INote[];

                    /** NoteList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new NoteList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns NoteList instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.INoteList): rntme.contracts.crm.v1.NoteList;

                    /**
                     * Encodes the specified NoteList message. Does not implicitly {@link rntme.contracts.crm.v1.NoteList.verify|verify} messages.
                     * @param message NoteList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.INoteList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified NoteList message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.NoteList.verify|verify} messages.
                     * @param message NoteList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.INoteList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a NoteList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns NoteList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.NoteList;

                    /**
                     * Decodes a NoteList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns NoteList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.NoteList;

                    /**
                     * Verifies a NoteList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a NoteList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns NoteList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.NoteList;

                    /**
                     * Creates a plain object from a NoteList message. Also converts values to other types if specified.
                     * @param message NoteList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.NoteList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this NoteList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for NoteList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateNoteRequest. */
                interface ICreateNoteRequest {

                    /** CreateNoteRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateNoteRequest content */
                    content?: (string|null);

                    /** CreateNoteRequest title */
                    title?: (string|null);

                    /** CreateNoteRequest parent */
                    parent?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** CreateNoteRequest author_canonical_id */
                    author_canonical_id?: (string|null);

                    /** CreateNoteRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents a CreateNoteRequest. */
                class CreateNoteRequest implements ICreateNoteRequest {

                    /**
                     * Constructs a new CreateNoteRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICreateNoteRequest);

                    /** CreateNoteRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateNoteRequest content. */
                    public content: string;

                    /** CreateNoteRequest title. */
                    public title: string;

                    /** CreateNoteRequest parent. */
                    public parent?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** CreateNoteRequest author_canonical_id. */
                    public author_canonical_id: string;

                    /** CreateNoteRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new CreateNoteRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateNoteRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICreateNoteRequest): rntme.contracts.crm.v1.CreateNoteRequest;

                    /**
                     * Encodes the specified CreateNoteRequest message. Does not implicitly {@link rntme.contracts.crm.v1.CreateNoteRequest.verify|verify} messages.
                     * @param message CreateNoteRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICreateNoteRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateNoteRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CreateNoteRequest.verify|verify} messages.
                     * @param message CreateNoteRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICreateNoteRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateNoteRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateNoteRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CreateNoteRequest;

                    /**
                     * Decodes a CreateNoteRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateNoteRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CreateNoteRequest;

                    /**
                     * Verifies a CreateNoteRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateNoteRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateNoteRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CreateNoteRequest;

                    /**
                     * Creates a plain object from a CreateNoteRequest message. Also converts values to other types if specified.
                     * @param message CreateNoteRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CreateNoteRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateNoteRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateNoteRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteNoteRequest. */
                interface IDeleteNoteRequest {

                    /** DeleteNoteRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteNoteRequest canonical_id */
                    canonical_id?: (string|null);

                    /** DeleteNoteRequest hard_delete */
                    hard_delete?: (boolean|null);
                }

                /** Represents a DeleteNoteRequest. */
                class DeleteNoteRequest implements IDeleteNoteRequest {

                    /**
                     * Constructs a new DeleteNoteRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDeleteNoteRequest);

                    /** DeleteNoteRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteNoteRequest canonical_id. */
                    public canonical_id: string;

                    /** DeleteNoteRequest hard_delete. */
                    public hard_delete: boolean;

                    /**
                     * Creates a new DeleteNoteRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteNoteRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDeleteNoteRequest): rntme.contracts.crm.v1.DeleteNoteRequest;

                    /**
                     * Encodes the specified DeleteNoteRequest message. Does not implicitly {@link rntme.contracts.crm.v1.DeleteNoteRequest.verify|verify} messages.
                     * @param message DeleteNoteRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDeleteNoteRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteNoteRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DeleteNoteRequest.verify|verify} messages.
                     * @param message DeleteNoteRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDeleteNoteRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteNoteRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteNoteRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DeleteNoteRequest;

                    /**
                     * Decodes a DeleteNoteRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteNoteRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DeleteNoteRequest;

                    /**
                     * Verifies a DeleteNoteRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteNoteRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteNoteRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DeleteNoteRequest;

                    /**
                     * Creates a plain object from a DeleteNoteRequest message. Also converts values to other types if specified.
                     * @param message DeleteNoteRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DeleteNoteRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteNoteRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteNoteRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListPipelinesRequest. */
                interface IListPipelinesRequest {

                    /** ListPipelinesRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListPipelinesRequest entity_type */
                    entity_type?: (string|null);
                }

                /** Represents a ListPipelinesRequest. */
                class ListPipelinesRequest implements IListPipelinesRequest {

                    /**
                     * Constructs a new ListPipelinesRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IListPipelinesRequest);

                    /** ListPipelinesRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListPipelinesRequest entity_type. */
                    public entity_type: string;

                    /**
                     * Creates a new ListPipelinesRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListPipelinesRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IListPipelinesRequest): rntme.contracts.crm.v1.ListPipelinesRequest;

                    /**
                     * Encodes the specified ListPipelinesRequest message. Does not implicitly {@link rntme.contracts.crm.v1.ListPipelinesRequest.verify|verify} messages.
                     * @param message ListPipelinesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IListPipelinesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListPipelinesRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ListPipelinesRequest.verify|verify} messages.
                     * @param message ListPipelinesRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IListPipelinesRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListPipelinesRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListPipelinesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ListPipelinesRequest;

                    /**
                     * Decodes a ListPipelinesRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListPipelinesRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ListPipelinesRequest;

                    /**
                     * Verifies a ListPipelinesRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListPipelinesRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListPipelinesRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ListPipelinesRequest;

                    /**
                     * Creates a plain object from a ListPipelinesRequest message. Also converts values to other types if specified.
                     * @param message ListPipelinesRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ListPipelinesRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListPipelinesRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListPipelinesRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a PipelineList. */
                interface IPipelineList {

                    /** PipelineList items */
                    items?: (rntme.contracts.crm.v1.IPipeline[]|null);

                    /** PipelineList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents a PipelineList. */
                class PipelineList implements IPipelineList {

                    /**
                     * Constructs a new PipelineList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IPipelineList);

                    /** PipelineList items. */
                    public items: rntme.contracts.crm.v1.IPipeline[];

                    /** PipelineList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new PipelineList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns PipelineList instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IPipelineList): rntme.contracts.crm.v1.PipelineList;

                    /**
                     * Encodes the specified PipelineList message. Does not implicitly {@link rntme.contracts.crm.v1.PipelineList.verify|verify} messages.
                     * @param message PipelineList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IPipelineList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified PipelineList message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.PipelineList.verify|verify} messages.
                     * @param message PipelineList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IPipelineList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a PipelineList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns PipelineList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.PipelineList;

                    /**
                     * Decodes a PipelineList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns PipelineList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.PipelineList;

                    /**
                     * Verifies a PipelineList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a PipelineList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns PipelineList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.PipelineList;

                    /**
                     * Creates a plain object from a PipelineList message. Also converts values to other types if specified.
                     * @param message PipelineList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.PipelineList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this PipelineList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for PipelineList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListCustomFieldDefinitionsRequest. */
                interface IListCustomFieldDefinitionsRequest {

                    /** ListCustomFieldDefinitionsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListCustomFieldDefinitionsRequest entity_type */
                    entity_type?: (string|null);
                }

                /** Represents a ListCustomFieldDefinitionsRequest. */
                class ListCustomFieldDefinitionsRequest implements IListCustomFieldDefinitionsRequest {

                    /**
                     * Constructs a new ListCustomFieldDefinitionsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IListCustomFieldDefinitionsRequest);

                    /** ListCustomFieldDefinitionsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListCustomFieldDefinitionsRequest entity_type. */
                    public entity_type: string;

                    /**
                     * Creates a new ListCustomFieldDefinitionsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListCustomFieldDefinitionsRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IListCustomFieldDefinitionsRequest): rntme.contracts.crm.v1.ListCustomFieldDefinitionsRequest;

                    /**
                     * Encodes the specified ListCustomFieldDefinitionsRequest message. Does not implicitly {@link rntme.contracts.crm.v1.ListCustomFieldDefinitionsRequest.verify|verify} messages.
                     * @param message ListCustomFieldDefinitionsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IListCustomFieldDefinitionsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListCustomFieldDefinitionsRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ListCustomFieldDefinitionsRequest.verify|verify} messages.
                     * @param message ListCustomFieldDefinitionsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IListCustomFieldDefinitionsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListCustomFieldDefinitionsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListCustomFieldDefinitionsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ListCustomFieldDefinitionsRequest;

                    /**
                     * Decodes a ListCustomFieldDefinitionsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListCustomFieldDefinitionsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ListCustomFieldDefinitionsRequest;

                    /**
                     * Verifies a ListCustomFieldDefinitionsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListCustomFieldDefinitionsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListCustomFieldDefinitionsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ListCustomFieldDefinitionsRequest;

                    /**
                     * Creates a plain object from a ListCustomFieldDefinitionsRequest message. Also converts values to other types if specified.
                     * @param message ListCustomFieldDefinitionsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ListCustomFieldDefinitionsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListCustomFieldDefinitionsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListCustomFieldDefinitionsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CustomFieldDefinitionList. */
                interface ICustomFieldDefinitionList {

                    /** CustomFieldDefinitionList items */
                    items?: (rntme.contracts.crm.v1.ICustomFieldDefinition[]|null);

                    /** CustomFieldDefinitionList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents a CustomFieldDefinitionList. */
                class CustomFieldDefinitionList implements ICustomFieldDefinitionList {

                    /**
                     * Constructs a new CustomFieldDefinitionList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICustomFieldDefinitionList);

                    /** CustomFieldDefinitionList items. */
                    public items: rntme.contracts.crm.v1.ICustomFieldDefinition[];

                    /** CustomFieldDefinitionList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new CustomFieldDefinitionList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CustomFieldDefinitionList instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICustomFieldDefinitionList): rntme.contracts.crm.v1.CustomFieldDefinitionList;

                    /**
                     * Encodes the specified CustomFieldDefinitionList message. Does not implicitly {@link rntme.contracts.crm.v1.CustomFieldDefinitionList.verify|verify} messages.
                     * @param message CustomFieldDefinitionList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICustomFieldDefinitionList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CustomFieldDefinitionList message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CustomFieldDefinitionList.verify|verify} messages.
                     * @param message CustomFieldDefinitionList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICustomFieldDefinitionList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CustomFieldDefinitionList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CustomFieldDefinitionList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CustomFieldDefinitionList;

                    /**
                     * Decodes a CustomFieldDefinitionList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CustomFieldDefinitionList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CustomFieldDefinitionList;

                    /**
                     * Verifies a CustomFieldDefinitionList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CustomFieldDefinitionList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CustomFieldDefinitionList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CustomFieldDefinitionList;

                    /**
                     * Creates a plain object from a CustomFieldDefinitionList message. Also converts values to other types if specified.
                     * @param message CustomFieldDefinitionList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CustomFieldDefinitionList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CustomFieldDefinitionList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CustomFieldDefinitionList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateAssociationRequest. */
                interface ICreateAssociationRequest {

                    /** CreateAssociationRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateAssociationRequest from */
                    from?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** CreateAssociationRequest to */
                    to?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** CreateAssociationRequest category */
                    category?: (rntme.contracts.crm.v1.AssociationCategory|null);

                    /** CreateAssociationRequest label */
                    label?: (string|null);

                    /** CreateAssociationRequest metadata */
                    metadata?: (google.protobuf.IStruct|null);
                }

                /** Represents a CreateAssociationRequest. */
                class CreateAssociationRequest implements ICreateAssociationRequest {

                    /**
                     * Constructs a new CreateAssociationRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICreateAssociationRequest);

                    /** CreateAssociationRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateAssociationRequest from. */
                    public from?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** CreateAssociationRequest to. */
                    public to?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** CreateAssociationRequest category. */
                    public category: rntme.contracts.crm.v1.AssociationCategory;

                    /** CreateAssociationRequest label. */
                    public label: string;

                    /** CreateAssociationRequest metadata. */
                    public metadata?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new CreateAssociationRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateAssociationRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICreateAssociationRequest): rntme.contracts.crm.v1.CreateAssociationRequest;

                    /**
                     * Encodes the specified CreateAssociationRequest message. Does not implicitly {@link rntme.contracts.crm.v1.CreateAssociationRequest.verify|verify} messages.
                     * @param message CreateAssociationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICreateAssociationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateAssociationRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CreateAssociationRequest.verify|verify} messages.
                     * @param message CreateAssociationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICreateAssociationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateAssociationRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateAssociationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CreateAssociationRequest;

                    /**
                     * Decodes a CreateAssociationRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateAssociationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CreateAssociationRequest;

                    /**
                     * Verifies a CreateAssociationRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateAssociationRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateAssociationRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CreateAssociationRequest;

                    /**
                     * Creates a plain object from a CreateAssociationRequest message. Also converts values to other types if specified.
                     * @param message CreateAssociationRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CreateAssociationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateAssociationRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateAssociationRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteAssociationRequest. */
                interface IDeleteAssociationRequest {

                    /** DeleteAssociationRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteAssociationRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a DeleteAssociationRequest. */
                class DeleteAssociationRequest implements IDeleteAssociationRequest {

                    /**
                     * Constructs a new DeleteAssociationRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IDeleteAssociationRequest);

                    /** DeleteAssociationRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteAssociationRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new DeleteAssociationRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteAssociationRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IDeleteAssociationRequest): rntme.contracts.crm.v1.DeleteAssociationRequest;

                    /**
                     * Encodes the specified DeleteAssociationRequest message. Does not implicitly {@link rntme.contracts.crm.v1.DeleteAssociationRequest.verify|verify} messages.
                     * @param message DeleteAssociationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IDeleteAssociationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteAssociationRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.DeleteAssociationRequest.verify|verify} messages.
                     * @param message DeleteAssociationRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IDeleteAssociationRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteAssociationRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteAssociationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.DeleteAssociationRequest;

                    /**
                     * Decodes a DeleteAssociationRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteAssociationRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.DeleteAssociationRequest;

                    /**
                     * Verifies a DeleteAssociationRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteAssociationRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteAssociationRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.DeleteAssociationRequest;

                    /**
                     * Creates a plain object from a DeleteAssociationRequest message. Also converts values to other types if specified.
                     * @param message DeleteAssociationRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.DeleteAssociationRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteAssociationRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteAssociationRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListAssociationsRequest. */
                interface IListAssociationsRequest {

                    /** ListAssociationsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListAssociationsRequest from */
                    from?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** ListAssociationsRequest to_entity_type */
                    to_entity_type?: (string|null);

                    /** ListAssociationsRequest label */
                    label?: (string|null);
                }

                /** Represents a ListAssociationsRequest. */
                class ListAssociationsRequest implements IListAssociationsRequest {

                    /**
                     * Constructs a new ListAssociationsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IListAssociationsRequest);

                    /** ListAssociationsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListAssociationsRequest from. */
                    public from?: (rntme.contracts.crm.v1.IEntityRef|null);

                    /** ListAssociationsRequest to_entity_type. */
                    public to_entity_type: string;

                    /** ListAssociationsRequest label. */
                    public label: string;

                    /**
                     * Creates a new ListAssociationsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListAssociationsRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IListAssociationsRequest): rntme.contracts.crm.v1.ListAssociationsRequest;

                    /**
                     * Encodes the specified ListAssociationsRequest message. Does not implicitly {@link rntme.contracts.crm.v1.ListAssociationsRequest.verify|verify} messages.
                     * @param message ListAssociationsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IListAssociationsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListAssociationsRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ListAssociationsRequest.verify|verify} messages.
                     * @param message ListAssociationsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IListAssociationsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListAssociationsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListAssociationsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ListAssociationsRequest;

                    /**
                     * Decodes a ListAssociationsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListAssociationsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ListAssociationsRequest;

                    /**
                     * Verifies a ListAssociationsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListAssociationsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListAssociationsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ListAssociationsRequest;

                    /**
                     * Creates a plain object from a ListAssociationsRequest message. Also converts values to other types if specified.
                     * @param message ListAssociationsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ListAssociationsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListAssociationsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListAssociationsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AssociationList. */
                interface IAssociationList {

                    /** AssociationList items */
                    items?: (rntme.contracts.crm.v1.IAssociation[]|null);

                    /** AssociationList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents an AssociationList. */
                class AssociationList implements IAssociationList {

                    /**
                     * Constructs a new AssociationList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAssociationList);

                    /** AssociationList items. */
                    public items: rntme.contracts.crm.v1.IAssociation[];

                    /** AssociationList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new AssociationList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AssociationList instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAssociationList): rntme.contracts.crm.v1.AssociationList;

                    /**
                     * Encodes the specified AssociationList message. Does not implicitly {@link rntme.contracts.crm.v1.AssociationList.verify|verify} messages.
                     * @param message AssociationList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAssociationList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AssociationList message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.AssociationList.verify|verify} messages.
                     * @param message AssociationList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAssociationList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AssociationList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AssociationList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.AssociationList;

                    /**
                     * Decodes an AssociationList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AssociationList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.AssociationList;

                    /**
                     * Verifies an AssociationList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AssociationList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AssociationList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.AssociationList;

                    /**
                     * Creates a plain object from an AssociationList message. Also converts values to other types if specified.
                     * @param message AssociationList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.AssociationList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AssociationList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AssociationList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SyncDeltaRequest. */
                interface ISyncDeltaRequest {

                    /** SyncDeltaRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** SyncDeltaRequest entity_type */
                    entity_type?: (string|null);

                    /** SyncDeltaRequest since */
                    since?: (google.protobuf.ITimestamp|null);

                    /** SyncDeltaRequest cursor */
                    cursor?: (string|null);

                    /** SyncDeltaRequest limit */
                    limit?: (number|null);
                }

                /** Represents a SyncDeltaRequest. */
                class SyncDeltaRequest implements ISyncDeltaRequest {

                    /**
                     * Constructs a new SyncDeltaRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ISyncDeltaRequest);

                    /** SyncDeltaRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** SyncDeltaRequest entity_type. */
                    public entity_type: string;

                    /** SyncDeltaRequest since. */
                    public since?: (google.protobuf.ITimestamp|null);

                    /** SyncDeltaRequest cursor. */
                    public cursor: string;

                    /** SyncDeltaRequest limit. */
                    public limit: number;

                    /**
                     * Creates a new SyncDeltaRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SyncDeltaRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ISyncDeltaRequest): rntme.contracts.crm.v1.SyncDeltaRequest;

                    /**
                     * Encodes the specified SyncDeltaRequest message. Does not implicitly {@link rntme.contracts.crm.v1.SyncDeltaRequest.verify|verify} messages.
                     * @param message SyncDeltaRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ISyncDeltaRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SyncDeltaRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.SyncDeltaRequest.verify|verify} messages.
                     * @param message SyncDeltaRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ISyncDeltaRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SyncDeltaRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SyncDeltaRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.SyncDeltaRequest;

                    /**
                     * Decodes a SyncDeltaRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SyncDeltaRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.SyncDeltaRequest;

                    /**
                     * Verifies a SyncDeltaRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SyncDeltaRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SyncDeltaRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.SyncDeltaRequest;

                    /**
                     * Creates a plain object from a SyncDeltaRequest message. Also converts values to other types if specified.
                     * @param message SyncDeltaRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.SyncDeltaRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SyncDeltaRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SyncDeltaRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SyncDeltaResponse. */
                interface ISyncDeltaResponse {

                    /** SyncDeltaResponse items */
                    items?: (rntme.contracts.crm.v1.ISyncDeltaItem[]|null);

                    /** SyncDeltaResponse next_cursor */
                    next_cursor?: (string|null);

                    /** SyncDeltaResponse watermark */
                    watermark?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a SyncDeltaResponse. */
                class SyncDeltaResponse implements ISyncDeltaResponse {

                    /**
                     * Constructs a new SyncDeltaResponse.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ISyncDeltaResponse);

                    /** SyncDeltaResponse items. */
                    public items: rntme.contracts.crm.v1.ISyncDeltaItem[];

                    /** SyncDeltaResponse next_cursor. */
                    public next_cursor: string;

                    /** SyncDeltaResponse watermark. */
                    public watermark?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new SyncDeltaResponse instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SyncDeltaResponse instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ISyncDeltaResponse): rntme.contracts.crm.v1.SyncDeltaResponse;

                    /**
                     * Encodes the specified SyncDeltaResponse message. Does not implicitly {@link rntme.contracts.crm.v1.SyncDeltaResponse.verify|verify} messages.
                     * @param message SyncDeltaResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ISyncDeltaResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SyncDeltaResponse message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.SyncDeltaResponse.verify|verify} messages.
                     * @param message SyncDeltaResponse message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ISyncDeltaResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SyncDeltaResponse message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SyncDeltaResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.SyncDeltaResponse;

                    /**
                     * Decodes a SyncDeltaResponse message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SyncDeltaResponse
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.SyncDeltaResponse;

                    /**
                     * Verifies a SyncDeltaResponse message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SyncDeltaResponse message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SyncDeltaResponse
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.SyncDeltaResponse;

                    /**
                     * Creates a plain object from a SyncDeltaResponse message. Also converts values to other types if specified.
                     * @param message SyncDeltaResponse
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.SyncDeltaResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SyncDeltaResponse to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SyncDeltaResponse
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SyncDeltaItem. */
                interface ISyncDeltaItem {

                    /** SyncDeltaItem canonical_id */
                    canonical_id?: (string|null);

                    /** SyncDeltaItem op */
                    op?: (rntme.contracts.crm.v1.SyncDeltaOp|null);

                    /** SyncDeltaItem entity */
                    entity?: (google.protobuf.IAny|null);

                    /** SyncDeltaItem changed_at */
                    changed_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a SyncDeltaItem. */
                class SyncDeltaItem implements ISyncDeltaItem {

                    /**
                     * Constructs a new SyncDeltaItem.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ISyncDeltaItem);

                    /** SyncDeltaItem canonical_id. */
                    public canonical_id: string;

                    /** SyncDeltaItem op. */
                    public op: rntme.contracts.crm.v1.SyncDeltaOp;

                    /** SyncDeltaItem entity. */
                    public entity?: (google.protobuf.IAny|null);

                    /** SyncDeltaItem changed_at. */
                    public changed_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new SyncDeltaItem instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SyncDeltaItem instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ISyncDeltaItem): rntme.contracts.crm.v1.SyncDeltaItem;

                    /**
                     * Encodes the specified SyncDeltaItem message. Does not implicitly {@link rntme.contracts.crm.v1.SyncDeltaItem.verify|verify} messages.
                     * @param message SyncDeltaItem message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ISyncDeltaItem, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SyncDeltaItem message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.SyncDeltaItem.verify|verify} messages.
                     * @param message SyncDeltaItem message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ISyncDeltaItem, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SyncDeltaItem message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SyncDeltaItem
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.SyncDeltaItem;

                    /**
                     * Decodes a SyncDeltaItem message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SyncDeltaItem
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.SyncDeltaItem;

                    /**
                     * Verifies a SyncDeltaItem message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SyncDeltaItem message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SyncDeltaItem
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.SyncDeltaItem;

                    /**
                     * Creates a plain object from a SyncDeltaItem message. Also converts values to other types if specified.
                     * @param message SyncDeltaItem
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.SyncDeltaItem, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SyncDeltaItem to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SyncDeltaItem
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SubmitJobRequest. */
                interface ISubmitJobRequest {

                    /** SubmitJobRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** SubmitJobRequest sync_full */
                    sync_full?: (rntme.contracts.crm.v1.ISyncFullPayload|null);

                    /** SubmitJobRequest ttl */
                    ttl?: (google.protobuf.IDuration|null);
                }

                /** Represents a SubmitJobRequest. */
                class SubmitJobRequest implements ISubmitJobRequest {

                    /**
                     * Constructs a new SubmitJobRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ISubmitJobRequest);

                    /** SubmitJobRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** SubmitJobRequest sync_full. */
                    public sync_full?: (rntme.contracts.crm.v1.ISyncFullPayload|null);

                    /** SubmitJobRequest ttl. */
                    public ttl?: (google.protobuf.IDuration|null);

                    /** SubmitJobRequest body. */
                    public body?: "sync_full";

                    /**
                     * Creates a new SubmitJobRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SubmitJobRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ISubmitJobRequest): rntme.contracts.crm.v1.SubmitJobRequest;

                    /**
                     * Encodes the specified SubmitJobRequest message. Does not implicitly {@link rntme.contracts.crm.v1.SubmitJobRequest.verify|verify} messages.
                     * @param message SubmitJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ISubmitJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SubmitJobRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.SubmitJobRequest.verify|verify} messages.
                     * @param message SubmitJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ISubmitJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SubmitJobRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SubmitJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.SubmitJobRequest;

                    /**
                     * Decodes a SubmitJobRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SubmitJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.SubmitJobRequest;

                    /**
                     * Verifies a SubmitJobRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SubmitJobRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SubmitJobRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.SubmitJobRequest;

                    /**
                     * Creates a plain object from a SubmitJobRequest message. Also converts values to other types if specified.
                     * @param message SubmitJobRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.SubmitJobRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SubmitJobRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SubmitJobRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetJobRequest. */
                interface IGetJobRequest {

                    /** GetJobRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetJobRequest. */
                class GetJobRequest implements IGetJobRequest {

                    /**
                     * Constructs a new GetJobRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IGetJobRequest);

                    /** GetJobRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetJobRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetJobRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IGetJobRequest): rntme.contracts.crm.v1.GetJobRequest;

                    /**
                     * Encodes the specified GetJobRequest message. Does not implicitly {@link rntme.contracts.crm.v1.GetJobRequest.verify|verify} messages.
                     * @param message GetJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IGetJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetJobRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.GetJobRequest.verify|verify} messages.
                     * @param message GetJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IGetJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetJobRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.GetJobRequest;

                    /**
                     * Decodes a GetJobRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.GetJobRequest;

                    /**
                     * Verifies a GetJobRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetJobRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetJobRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.GetJobRequest;

                    /**
                     * Creates a plain object from a GetJobRequest message. Also converts values to other types if specified.
                     * @param message GetJobRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.GetJobRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetJobRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetJobRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CancelJobRequest. */
                interface ICancelJobRequest {

                    /** CancelJobRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CancelJobRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a CancelJobRequest. */
                class CancelJobRequest implements ICancelJobRequest {

                    /**
                     * Constructs a new CancelJobRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.ICancelJobRequest);

                    /** CancelJobRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CancelJobRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new CancelJobRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CancelJobRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.ICancelJobRequest): rntme.contracts.crm.v1.CancelJobRequest;

                    /**
                     * Encodes the specified CancelJobRequest message. Does not implicitly {@link rntme.contracts.crm.v1.CancelJobRequest.verify|verify} messages.
                     * @param message CancelJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.ICancelJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CancelJobRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.CancelJobRequest.verify|verify} messages.
                     * @param message CancelJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.ICancelJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CancelJobRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CancelJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.CancelJobRequest;

                    /**
                     * Decodes a CancelJobRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CancelJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.CancelJobRequest;

                    /**
                     * Verifies a CancelJobRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CancelJobRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CancelJobRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.CancelJobRequest;

                    /**
                     * Creates a plain object from a CancelJobRequest message. Also converts values to other types if specified.
                     * @param message CancelJobRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.CancelJobRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CancelJobRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CancelJobRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListJobsRequest. */
                interface IListJobsRequest {

                    /** ListJobsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListJobsRequest type */
                    type?: (rntme.contracts.crm.v1.AsyncJobType|null);

                    /** ListJobsRequest status */
                    status?: (rntme.contracts.crm.v1.AsyncJobStatus|null);
                }

                /** Represents a ListJobsRequest. */
                class ListJobsRequest implements IListJobsRequest {

                    /**
                     * Constructs a new ListJobsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IListJobsRequest);

                    /** ListJobsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListJobsRequest type. */
                    public type: rntme.contracts.crm.v1.AsyncJobType;

                    /** ListJobsRequest status. */
                    public status: rntme.contracts.crm.v1.AsyncJobStatus;

                    /**
                     * Creates a new ListJobsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListJobsRequest instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IListJobsRequest): rntme.contracts.crm.v1.ListJobsRequest;

                    /**
                     * Encodes the specified ListJobsRequest message. Does not implicitly {@link rntme.contracts.crm.v1.ListJobsRequest.verify|verify} messages.
                     * @param message ListJobsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IListJobsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListJobsRequest message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.ListJobsRequest.verify|verify} messages.
                     * @param message ListJobsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IListJobsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListJobsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListJobsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.ListJobsRequest;

                    /**
                     * Decodes a ListJobsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListJobsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.ListJobsRequest;

                    /**
                     * Verifies a ListJobsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListJobsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListJobsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.ListJobsRequest;

                    /**
                     * Creates a plain object from a ListJobsRequest message. Also converts values to other types if specified.
                     * @param message ListJobsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.ListJobsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListJobsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListJobsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AsyncJobList. */
                interface IAsyncJobList {

                    /** AsyncJobList items */
                    items?: (rntme.contracts.crm.v1.IAsyncJob[]|null);

                    /** AsyncJobList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents an AsyncJobList. */
                class AsyncJobList implements IAsyncJobList {

                    /**
                     * Constructs a new AsyncJobList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.crm.v1.IAsyncJobList);

                    /** AsyncJobList items. */
                    public items: rntme.contracts.crm.v1.IAsyncJob[];

                    /** AsyncJobList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new AsyncJobList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobList instance
                     */
                    public static create(properties?: rntme.contracts.crm.v1.IAsyncJobList): rntme.contracts.crm.v1.AsyncJobList;

                    /**
                     * Encodes the specified AsyncJobList message. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobList.verify|verify} messages.
                     * @param message AsyncJobList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.crm.v1.IAsyncJobList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobList message, length delimited. Does not implicitly {@link rntme.contracts.crm.v1.AsyncJobList.verify|verify} messages.
                     * @param message AsyncJobList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.crm.v1.IAsyncJobList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.crm.v1.AsyncJobList;

                    /**
                     * Decodes an AsyncJobList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.crm.v1.AsyncJobList;

                    /**
                     * Verifies an AsyncJobList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AsyncJobList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AsyncJobList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.crm.v1.AsyncJobList;

                    /**
                     * Creates a plain object from an AsyncJobList message. Also converts values to other types if specified.
                     * @param message AsyncJobList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.crm.v1.AsyncJobList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AsyncJobList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AsyncJobList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
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

        /** Properties of an Any. */
        interface IAny {

            /** Any type_url */
            type_url?: (string|null);

            /** Any value */
            value?: (Uint8Array|null);
        }

        /** Represents an Any. */
        class Any implements IAny {

            /**
             * Constructs a new Any.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IAny);

            /** Any type_url. */
            public type_url: string;

            /** Any value. */
            public value: Uint8Array;

            /**
             * Creates a new Any instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Any instance
             */
            public static create(properties?: google.protobuf.IAny): google.protobuf.Any;

            /**
             * Encodes the specified Any message. Does not implicitly {@link google.protobuf.Any.verify|verify} messages.
             * @param message Any message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IAny, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Any message, length delimited. Does not implicitly {@link google.protobuf.Any.verify|verify} messages.
             * @param message Any message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IAny, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Any message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Any
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Any;

            /**
             * Decodes an Any message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Any
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Any;

            /**
             * Verifies an Any message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an Any message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Any
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Any;

            /**
             * Creates a plain object from an Any message. Also converts values to other types if specified.
             * @param message Any
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Any, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Any to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Any
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Duration. */
        interface IDuration {

            /** Duration seconds */
            seconds?: (number|Long|null);

            /** Duration nanos */
            nanos?: (number|null);
        }

        /** Represents a Duration. */
        class Duration implements IDuration {

            /**
             * Constructs a new Duration.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IDuration);

            /** Duration seconds. */
            public seconds: (number|Long);

            /** Duration nanos. */
            public nanos: number;

            /**
             * Creates a new Duration instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Duration instance
             */
            public static create(properties?: google.protobuf.IDuration): google.protobuf.Duration;

            /**
             * Encodes the specified Duration message. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
             * @param message Duration message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IDuration, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Duration message, length delimited. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
             * @param message Duration message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IDuration, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Duration message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Duration
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Duration;

            /**
             * Decodes a Duration message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Duration
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Duration;

            /**
             * Verifies a Duration message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Duration message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Duration
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Duration;

            /**
             * Creates a plain object from a Duration message. Also converts values to other types if specified.
             * @param message Duration
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Duration, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Duration to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Duration
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
