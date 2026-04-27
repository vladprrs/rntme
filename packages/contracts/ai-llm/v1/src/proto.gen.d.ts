import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace rntme. */
export namespace rntme {

    /** Namespace contracts. */
    namespace contracts {

        /** Namespace ai_llm. */
        namespace ai_llm {

            /** Namespace v1. */
            namespace v1 {

                /** Properties of a CompletionStarted. */
                interface ICompletionStarted {

                    /** CompletionStarted completion_id */
                    completion_id?: (string|null);

                    /** CompletionStarted model */
                    model?: (string|null);

                    /** CompletionStarted input_token_estimate */
                    input_token_estimate?: (number|null);

                    /** CompletionStarted started_at */
                    started_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a CompletionStarted. */
                class CompletionStarted implements ICompletionStarted {

                    /**
                     * Constructs a new CompletionStarted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ICompletionStarted);

                    /** CompletionStarted completion_id. */
                    public completion_id: string;

                    /** CompletionStarted model. */
                    public model: string;

                    /** CompletionStarted input_token_estimate. */
                    public input_token_estimate: number;

                    /** CompletionStarted started_at. */
                    public started_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new CompletionStarted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CompletionStarted instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ICompletionStarted): rntme.contracts.ai_llm.v1.CompletionStarted;

                    /**
                     * Encodes the specified CompletionStarted message. Does not implicitly {@link rntme.contracts.ai_llm.v1.CompletionStarted.verify|verify} messages.
                     * @param message CompletionStarted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ICompletionStarted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CompletionStarted message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.CompletionStarted.verify|verify} messages.
                     * @param message CompletionStarted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ICompletionStarted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CompletionStarted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CompletionStarted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.CompletionStarted;

                    /**
                     * Decodes a CompletionStarted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CompletionStarted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.CompletionStarted;

                    /**
                     * Verifies a CompletionStarted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CompletionStarted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CompletionStarted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.CompletionStarted;

                    /**
                     * Creates a plain object from a CompletionStarted message. Also converts values to other types if specified.
                     * @param message CompletionStarted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.CompletionStarted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CompletionStarted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CompletionStarted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CompletionFinished. */
                interface ICompletionFinished {

                    /** CompletionFinished completion */
                    completion?: (rntme.contracts.ai_llm.v1.ICompletion|null);
                }

                /** Represents a CompletionFinished. */
                class CompletionFinished implements ICompletionFinished {

                    /**
                     * Constructs a new CompletionFinished.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ICompletionFinished);

                    /** CompletionFinished completion. */
                    public completion?: (rntme.contracts.ai_llm.v1.ICompletion|null);

                    /**
                     * Creates a new CompletionFinished instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CompletionFinished instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ICompletionFinished): rntme.contracts.ai_llm.v1.CompletionFinished;

                    /**
                     * Encodes the specified CompletionFinished message. Does not implicitly {@link rntme.contracts.ai_llm.v1.CompletionFinished.verify|verify} messages.
                     * @param message CompletionFinished message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ICompletionFinished, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CompletionFinished message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.CompletionFinished.verify|verify} messages.
                     * @param message CompletionFinished message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ICompletionFinished, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CompletionFinished message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CompletionFinished
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.CompletionFinished;

                    /**
                     * Decodes a CompletionFinished message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CompletionFinished
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.CompletionFinished;

                    /**
                     * Verifies a CompletionFinished message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CompletionFinished message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CompletionFinished
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.CompletionFinished;

                    /**
                     * Creates a plain object from a CompletionFinished message. Also converts values to other types if specified.
                     * @param message CompletionFinished
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.CompletionFinished, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CompletionFinished to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CompletionFinished
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CompletionFailed. */
                interface ICompletionFailed {

                    /** CompletionFailed completion_id */
                    completion_id?: (string|null);

                    /** CompletionFailed model */
                    model?: (string|null);

                    /** CompletionFailed error_code */
                    error_code?: (string|null);

                    /** CompletionFailed error_message */
                    error_message?: (string|null);

                    /** CompletionFailed failed_at */
                    failed_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a CompletionFailed. */
                class CompletionFailed implements ICompletionFailed {

                    /**
                     * Constructs a new CompletionFailed.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ICompletionFailed);

                    /** CompletionFailed completion_id. */
                    public completion_id: string;

                    /** CompletionFailed model. */
                    public model: string;

                    /** CompletionFailed error_code. */
                    public error_code: string;

                    /** CompletionFailed error_message. */
                    public error_message: string;

                    /** CompletionFailed failed_at. */
                    public failed_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new CompletionFailed instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CompletionFailed instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ICompletionFailed): rntme.contracts.ai_llm.v1.CompletionFailed;

                    /**
                     * Encodes the specified CompletionFailed message. Does not implicitly {@link rntme.contracts.ai_llm.v1.CompletionFailed.verify|verify} messages.
                     * @param message CompletionFailed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ICompletionFailed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CompletionFailed message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.CompletionFailed.verify|verify} messages.
                     * @param message CompletionFailed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ICompletionFailed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CompletionFailed message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CompletionFailed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.CompletionFailed;

                    /**
                     * Decodes a CompletionFailed message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CompletionFailed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.CompletionFailed;

                    /**
                     * Verifies a CompletionFailed message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CompletionFailed message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CompletionFailed
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.CompletionFailed;

                    /**
                     * Creates a plain object from a CompletionFailed message. Also converts values to other types if specified.
                     * @param message CompletionFailed
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.CompletionFailed, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CompletionFailed to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CompletionFailed
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadCreated. */
                interface IThreadCreated {

                    /** ThreadCreated thread */
                    thread?: (rntme.contracts.ai_llm.v1.IAssistantThread|null);

                    /** ThreadCreated creator_user_id */
                    creator_user_id?: (string|null);

                    /** ThreadCreated initial_message_count */
                    initial_message_count?: (number|null);
                }

                /** Represents a ThreadCreated. */
                class ThreadCreated implements IThreadCreated {

                    /**
                     * Constructs a new ThreadCreated.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadCreated);

                    /** ThreadCreated thread. */
                    public thread?: (rntme.contracts.ai_llm.v1.IAssistantThread|null);

                    /** ThreadCreated creator_user_id. */
                    public creator_user_id: string;

                    /** ThreadCreated initial_message_count. */
                    public initial_message_count: number;

                    /**
                     * Creates a new ThreadCreated instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadCreated instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadCreated): rntme.contracts.ai_llm.v1.ThreadCreated;

                    /**
                     * Encodes the specified ThreadCreated message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadCreated.verify|verify} messages.
                     * @param message ThreadCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadCreated message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadCreated.verify|verify} messages.
                     * @param message ThreadCreated message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadCreated, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadCreated message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadCreated;

                    /**
                     * Decodes a ThreadCreated message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadCreated
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadCreated;

                    /**
                     * Verifies a ThreadCreated message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadCreated message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadCreated
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadCreated;

                    /**
                     * Creates a plain object from a ThreadCreated message. Also converts values to other types if specified.
                     * @param message ThreadCreated
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadCreated, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadCreated to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadCreated
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadDeleted. */
                interface IThreadDeleted {

                    /** ThreadDeleted canonical_id */
                    canonical_id?: (string|null);

                    /** ThreadDeleted vendor_id */
                    vendor_id?: (string|null);

                    /** ThreadDeleted hard_delete */
                    hard_delete?: (boolean|null);

                    /** ThreadDeleted deleted_at */
                    deleted_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a ThreadDeleted. */
                class ThreadDeleted implements IThreadDeleted {

                    /**
                     * Constructs a new ThreadDeleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadDeleted);

                    /** ThreadDeleted canonical_id. */
                    public canonical_id: string;

                    /** ThreadDeleted vendor_id. */
                    public vendor_id: string;

                    /** ThreadDeleted hard_delete. */
                    public hard_delete: boolean;

                    /** ThreadDeleted deleted_at. */
                    public deleted_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new ThreadDeleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadDeleted instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadDeleted): rntme.contracts.ai_llm.v1.ThreadDeleted;

                    /**
                     * Encodes the specified ThreadDeleted message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadDeleted.verify|verify} messages.
                     * @param message ThreadDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadDeleted message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadDeleted.verify|verify} messages.
                     * @param message ThreadDeleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadDeleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadDeleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadDeleted;

                    /**
                     * Decodes a ThreadDeleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadDeleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadDeleted;

                    /**
                     * Verifies a ThreadDeleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadDeleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadDeleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadDeleted;

                    /**
                     * Creates a plain object from a ThreadDeleted message. Also converts values to other types if specified.
                     * @param message ThreadDeleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadDeleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadDeleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadDeleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadMessageAdded. */
                interface IThreadMessageAdded {

                    /** ThreadMessageAdded item */
                    item?: (rntme.contracts.ai_llm.v1.IThreadItem|null);
                }

                /** Represents a ThreadMessageAdded. */
                class ThreadMessageAdded implements IThreadMessageAdded {

                    /**
                     * Constructs a new ThreadMessageAdded.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadMessageAdded);

                    /** ThreadMessageAdded item. */
                    public item?: (rntme.contracts.ai_llm.v1.IThreadItem|null);

                    /**
                     * Creates a new ThreadMessageAdded instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadMessageAdded instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadMessageAdded): rntme.contracts.ai_llm.v1.ThreadMessageAdded;

                    /**
                     * Encodes the specified ThreadMessageAdded message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadMessageAdded.verify|verify} messages.
                     * @param message ThreadMessageAdded message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadMessageAdded, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadMessageAdded message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadMessageAdded.verify|verify} messages.
                     * @param message ThreadMessageAdded message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadMessageAdded, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadMessageAdded message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadMessageAdded
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadMessageAdded;

                    /**
                     * Decodes a ThreadMessageAdded message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadMessageAdded
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadMessageAdded;

                    /**
                     * Verifies a ThreadMessageAdded message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadMessageAdded message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadMessageAdded
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadMessageAdded;

                    /**
                     * Creates a plain object from a ThreadMessageAdded message. Also converts values to other types if specified.
                     * @param message ThreadMessageAdded
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadMessageAdded, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadMessageAdded to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadMessageAdded
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadRunStarted. */
                interface IThreadRunStarted {

                    /** ThreadRunStarted thread_id */
                    thread_id?: (string|null);

                    /** ThreadRunStarted run_id */
                    run_id?: (string|null);

                    /** ThreadRunStarted model */
                    model?: (string|null);

                    /** ThreadRunStarted started_at */
                    started_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a ThreadRunStarted. */
                class ThreadRunStarted implements IThreadRunStarted {

                    /**
                     * Constructs a new ThreadRunStarted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadRunStarted);

                    /** ThreadRunStarted thread_id. */
                    public thread_id: string;

                    /** ThreadRunStarted run_id. */
                    public run_id: string;

                    /** ThreadRunStarted model. */
                    public model: string;

                    /** ThreadRunStarted started_at. */
                    public started_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new ThreadRunStarted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadRunStarted instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadRunStarted): rntme.contracts.ai_llm.v1.ThreadRunStarted;

                    /**
                     * Encodes the specified ThreadRunStarted message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunStarted.verify|verify} messages.
                     * @param message ThreadRunStarted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadRunStarted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadRunStarted message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunStarted.verify|verify} messages.
                     * @param message ThreadRunStarted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadRunStarted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadRunStarted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadRunStarted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadRunStarted;

                    /**
                     * Decodes a ThreadRunStarted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadRunStarted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadRunStarted;

                    /**
                     * Verifies a ThreadRunStarted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadRunStarted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadRunStarted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadRunStarted;

                    /**
                     * Creates a plain object from a ThreadRunStarted message. Also converts values to other types if specified.
                     * @param message ThreadRunStarted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadRunStarted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadRunStarted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadRunStarted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadRunRequiresAction. */
                interface IThreadRunRequiresAction {

                    /** ThreadRunRequiresAction thread_id */
                    thread_id?: (string|null);

                    /** ThreadRunRequiresAction run_id */
                    run_id?: (string|null);

                    /** ThreadRunRequiresAction required_tool_calls */
                    required_tool_calls?: (rntme.contracts.ai_llm.v1.IToolCall[]|null);
                }

                /** Represents a ThreadRunRequiresAction. */
                class ThreadRunRequiresAction implements IThreadRunRequiresAction {

                    /**
                     * Constructs a new ThreadRunRequiresAction.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadRunRequiresAction);

                    /** ThreadRunRequiresAction thread_id. */
                    public thread_id: string;

                    /** ThreadRunRequiresAction run_id. */
                    public run_id: string;

                    /** ThreadRunRequiresAction required_tool_calls. */
                    public required_tool_calls: rntme.contracts.ai_llm.v1.IToolCall[];

                    /**
                     * Creates a new ThreadRunRequiresAction instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadRunRequiresAction instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadRunRequiresAction): rntme.contracts.ai_llm.v1.ThreadRunRequiresAction;

                    /**
                     * Encodes the specified ThreadRunRequiresAction message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunRequiresAction.verify|verify} messages.
                     * @param message ThreadRunRequiresAction message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadRunRequiresAction, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadRunRequiresAction message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunRequiresAction.verify|verify} messages.
                     * @param message ThreadRunRequiresAction message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadRunRequiresAction, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadRunRequiresAction message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadRunRequiresAction
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadRunRequiresAction;

                    /**
                     * Decodes a ThreadRunRequiresAction message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadRunRequiresAction
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadRunRequiresAction;

                    /**
                     * Verifies a ThreadRunRequiresAction message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadRunRequiresAction message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadRunRequiresAction
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadRunRequiresAction;

                    /**
                     * Creates a plain object from a ThreadRunRequiresAction message. Also converts values to other types if specified.
                     * @param message ThreadRunRequiresAction
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadRunRequiresAction, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadRunRequiresAction to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadRunRequiresAction
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadRunCompleted. */
                interface IThreadRunCompleted {

                    /** ThreadRunCompleted run */
                    run?: (rntme.contracts.ai_llm.v1.IThreadRun|null);

                    /** ThreadRunCompleted new_items */
                    new_items?: (rntme.contracts.ai_llm.v1.IThreadItem[]|null);
                }

                /** Represents a ThreadRunCompleted. */
                class ThreadRunCompleted implements IThreadRunCompleted {

                    /**
                     * Constructs a new ThreadRunCompleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadRunCompleted);

                    /** ThreadRunCompleted run. */
                    public run?: (rntme.contracts.ai_llm.v1.IThreadRun|null);

                    /** ThreadRunCompleted new_items. */
                    public new_items: rntme.contracts.ai_llm.v1.IThreadItem[];

                    /**
                     * Creates a new ThreadRunCompleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadRunCompleted instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadRunCompleted): rntme.contracts.ai_llm.v1.ThreadRunCompleted;

                    /**
                     * Encodes the specified ThreadRunCompleted message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunCompleted.verify|verify} messages.
                     * @param message ThreadRunCompleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadRunCompleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadRunCompleted message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunCompleted.verify|verify} messages.
                     * @param message ThreadRunCompleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadRunCompleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadRunCompleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadRunCompleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadRunCompleted;

                    /**
                     * Decodes a ThreadRunCompleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadRunCompleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadRunCompleted;

                    /**
                     * Verifies a ThreadRunCompleted message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadRunCompleted message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadRunCompleted
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadRunCompleted;

                    /**
                     * Creates a plain object from a ThreadRunCompleted message. Also converts values to other types if specified.
                     * @param message ThreadRunCompleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadRunCompleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadRunCompleted to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadRunCompleted
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadRunFailed. */
                interface IThreadRunFailed {

                    /** ThreadRunFailed run */
                    run?: (rntme.contracts.ai_llm.v1.IThreadRun|null);

                    /** ThreadRunFailed error_code */
                    error_code?: (string|null);

                    /** ThreadRunFailed error_message */
                    error_message?: (string|null);
                }

                /** Represents a ThreadRunFailed. */
                class ThreadRunFailed implements IThreadRunFailed {

                    /**
                     * Constructs a new ThreadRunFailed.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadRunFailed);

                    /** ThreadRunFailed run. */
                    public run?: (rntme.contracts.ai_llm.v1.IThreadRun|null);

                    /** ThreadRunFailed error_code. */
                    public error_code: string;

                    /** ThreadRunFailed error_message. */
                    public error_message: string;

                    /**
                     * Creates a new ThreadRunFailed instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadRunFailed instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadRunFailed): rntme.contracts.ai_llm.v1.ThreadRunFailed;

                    /**
                     * Encodes the specified ThreadRunFailed message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunFailed.verify|verify} messages.
                     * @param message ThreadRunFailed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadRunFailed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadRunFailed message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunFailed.verify|verify} messages.
                     * @param message ThreadRunFailed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadRunFailed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadRunFailed message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadRunFailed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadRunFailed;

                    /**
                     * Decodes a ThreadRunFailed message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadRunFailed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadRunFailed;

                    /**
                     * Verifies a ThreadRunFailed message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadRunFailed message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadRunFailed
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadRunFailed;

                    /**
                     * Creates a plain object from a ThreadRunFailed message. Also converts values to other types if specified.
                     * @param message ThreadRunFailed
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadRunFailed, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadRunFailed to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadRunFailed
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadRunCancelled. */
                interface IThreadRunCancelled {

                    /** ThreadRunCancelled thread_id */
                    thread_id?: (string|null);

                    /** ThreadRunCancelled run_id */
                    run_id?: (string|null);

                    /** ThreadRunCancelled reason */
                    reason?: (string|null);

                    /** ThreadRunCancelled cancelled_at */
                    cancelled_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents a ThreadRunCancelled. */
                class ThreadRunCancelled implements IThreadRunCancelled {

                    /**
                     * Constructs a new ThreadRunCancelled.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadRunCancelled);

                    /** ThreadRunCancelled thread_id. */
                    public thread_id: string;

                    /** ThreadRunCancelled run_id. */
                    public run_id: string;

                    /** ThreadRunCancelled reason. */
                    public reason: string;

                    /** ThreadRunCancelled cancelled_at. */
                    public cancelled_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new ThreadRunCancelled instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadRunCancelled instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadRunCancelled): rntme.contracts.ai_llm.v1.ThreadRunCancelled;

                    /**
                     * Encodes the specified ThreadRunCancelled message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunCancelled.verify|verify} messages.
                     * @param message ThreadRunCancelled message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadRunCancelled, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadRunCancelled message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRunCancelled.verify|verify} messages.
                     * @param message ThreadRunCancelled message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadRunCancelled, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadRunCancelled message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadRunCancelled
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadRunCancelled;

                    /**
                     * Decodes a ThreadRunCancelled message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadRunCancelled
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadRunCancelled;

                    /**
                     * Verifies a ThreadRunCancelled message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadRunCancelled message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadRunCancelled
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadRunCancelled;

                    /**
                     * Creates a plain object from a ThreadRunCancelled message. Also converts values to other types if specified.
                     * @param message ThreadRunCancelled
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadRunCancelled, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadRunCancelled to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadRunCancelled
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AsyncJobSubmitted. */
                interface IAsyncJobSubmitted {

                    /** AsyncJobSubmitted job */
                    job?: (rntme.contracts.ai_llm.v1.IAsyncJob|null);

                    /** AsyncJobSubmitted type */
                    type?: (rntme.contracts.ai_llm.v1.AsyncJobType|null);

                    /** AsyncJobSubmitted input_item_count */
                    input_item_count?: (number|null);
                }

                /** Represents an AsyncJobSubmitted. */
                class AsyncJobSubmitted implements IAsyncJobSubmitted {

                    /**
                     * Constructs a new AsyncJobSubmitted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAsyncJobSubmitted);

                    /** AsyncJobSubmitted job. */
                    public job?: (rntme.contracts.ai_llm.v1.IAsyncJob|null);

                    /** AsyncJobSubmitted type. */
                    public type: rntme.contracts.ai_llm.v1.AsyncJobType;

                    /** AsyncJobSubmitted input_item_count. */
                    public input_item_count: number;

                    /**
                     * Creates a new AsyncJobSubmitted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobSubmitted instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAsyncJobSubmitted): rntme.contracts.ai_llm.v1.AsyncJobSubmitted;

                    /**
                     * Encodes the specified AsyncJobSubmitted message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobSubmitted.verify|verify} messages.
                     * @param message AsyncJobSubmitted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAsyncJobSubmitted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobSubmitted message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobSubmitted.verify|verify} messages.
                     * @param message AsyncJobSubmitted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAsyncJobSubmitted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobSubmitted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobSubmitted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AsyncJobSubmitted;

                    /**
                     * Decodes an AsyncJobSubmitted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobSubmitted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AsyncJobSubmitted;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AsyncJobSubmitted;

                    /**
                     * Creates a plain object from an AsyncJobSubmitted message. Also converts values to other types if specified.
                     * @param message AsyncJobSubmitted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AsyncJobSubmitted, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
                    type?: (rntme.contracts.ai_llm.v1.AsyncJobType|null);

                    /** AsyncJobStatusChanged previous_status */
                    previous_status?: (rntme.contracts.ai_llm.v1.AsyncJobStatus|null);

                    /** AsyncJobStatusChanged new_status */
                    new_status?: (rntme.contracts.ai_llm.v1.AsyncJobStatus|null);

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
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAsyncJobStatusChanged);

                    /** AsyncJobStatusChanged canonical_id. */
                    public canonical_id: string;

                    /** AsyncJobStatusChanged type. */
                    public type: rntme.contracts.ai_llm.v1.AsyncJobType;

                    /** AsyncJobStatusChanged previous_status. */
                    public previous_status: rntme.contracts.ai_llm.v1.AsyncJobStatus;

                    /** AsyncJobStatusChanged new_status. */
                    public new_status: rntme.contracts.ai_llm.v1.AsyncJobStatus;

                    /** AsyncJobStatusChanged progress_percentage. */
                    public progress_percentage: number;

                    /** AsyncJobStatusChanged transitioned_at. */
                    public transitioned_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new AsyncJobStatusChanged instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobStatusChanged instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAsyncJobStatusChanged): rntme.contracts.ai_llm.v1.AsyncJobStatusChanged;

                    /**
                     * Encodes the specified AsyncJobStatusChanged message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobStatusChanged.verify|verify} messages.
                     * @param message AsyncJobStatusChanged message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAsyncJobStatusChanged, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobStatusChanged message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobStatusChanged.verify|verify} messages.
                     * @param message AsyncJobStatusChanged message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAsyncJobStatusChanged, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobStatusChanged message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobStatusChanged
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AsyncJobStatusChanged;

                    /**
                     * Decodes an AsyncJobStatusChanged message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobStatusChanged
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AsyncJobStatusChanged;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AsyncJobStatusChanged;

                    /**
                     * Creates a plain object from an AsyncJobStatusChanged message. Also converts values to other types if specified.
                     * @param message AsyncJobStatusChanged
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AsyncJobStatusChanged, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
                    job?: (rntme.contracts.ai_llm.v1.IAsyncJob|null);
                }

                /** Represents an AsyncJobCompleted. */
                class AsyncJobCompleted implements IAsyncJobCompleted {

                    /**
                     * Constructs a new AsyncJobCompleted.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAsyncJobCompleted);

                    /** AsyncJobCompleted job. */
                    public job?: (rntme.contracts.ai_llm.v1.IAsyncJob|null);

                    /**
                     * Creates a new AsyncJobCompleted instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobCompleted instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAsyncJobCompleted): rntme.contracts.ai_llm.v1.AsyncJobCompleted;

                    /**
                     * Encodes the specified AsyncJobCompleted message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobCompleted.verify|verify} messages.
                     * @param message AsyncJobCompleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAsyncJobCompleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobCompleted message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobCompleted.verify|verify} messages.
                     * @param message AsyncJobCompleted message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAsyncJobCompleted, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobCompleted message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobCompleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AsyncJobCompleted;

                    /**
                     * Decodes an AsyncJobCompleted message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobCompleted
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AsyncJobCompleted;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AsyncJobCompleted;

                    /**
                     * Creates a plain object from an AsyncJobCompleted message. Also converts values to other types if specified.
                     * @param message AsyncJobCompleted
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AsyncJobCompleted, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
                    job?: (rntme.contracts.ai_llm.v1.IAsyncJob|null);

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
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAsyncJobFailed);

                    /** AsyncJobFailed job. */
                    public job?: (rntme.contracts.ai_llm.v1.IAsyncJob|null);

                    /** AsyncJobFailed error_code. */
                    public error_code: string;

                    /** AsyncJobFailed error_message. */
                    public error_message: string;

                    /**
                     * Creates a new AsyncJobFailed instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobFailed instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAsyncJobFailed): rntme.contracts.ai_llm.v1.AsyncJobFailed;

                    /**
                     * Encodes the specified AsyncJobFailed message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobFailed.verify|verify} messages.
                     * @param message AsyncJobFailed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAsyncJobFailed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobFailed message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobFailed.verify|verify} messages.
                     * @param message AsyncJobFailed message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAsyncJobFailed, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobFailed message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobFailed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AsyncJobFailed;

                    /**
                     * Decodes an AsyncJobFailed message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobFailed
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AsyncJobFailed;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AsyncJobFailed;

                    /**
                     * Creates a plain object from an AsyncJobFailed message. Also converts values to other types if specified.
                     * @param message AsyncJobFailed
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AsyncJobFailed, options?: $protobuf.IConversionOptions): { [k: string]: any };

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

                /** Properties of an AsyncJobCancelled. */
                interface IAsyncJobCancelled {

                    /** AsyncJobCancelled job */
                    job?: (rntme.contracts.ai_llm.v1.IAsyncJob|null);

                    /** AsyncJobCancelled reason */
                    reason?: (string|null);

                    /** AsyncJobCancelled cancelled_at */
                    cancelled_at?: (google.protobuf.ITimestamp|null);
                }

                /** Represents an AsyncJobCancelled. */
                class AsyncJobCancelled implements IAsyncJobCancelled {

                    /**
                     * Constructs a new AsyncJobCancelled.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAsyncJobCancelled);

                    /** AsyncJobCancelled job. */
                    public job?: (rntme.contracts.ai_llm.v1.IAsyncJob|null);

                    /** AsyncJobCancelled reason. */
                    public reason: string;

                    /** AsyncJobCancelled cancelled_at. */
                    public cancelled_at?: (google.protobuf.ITimestamp|null);

                    /**
                     * Creates a new AsyncJobCancelled instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobCancelled instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAsyncJobCancelled): rntme.contracts.ai_llm.v1.AsyncJobCancelled;

                    /**
                     * Encodes the specified AsyncJobCancelled message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobCancelled.verify|verify} messages.
                     * @param message AsyncJobCancelled message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAsyncJobCancelled, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobCancelled message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobCancelled.verify|verify} messages.
                     * @param message AsyncJobCancelled message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAsyncJobCancelled, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobCancelled message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobCancelled
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AsyncJobCancelled;

                    /**
                     * Decodes an AsyncJobCancelled message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobCancelled
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AsyncJobCancelled;

                    /**
                     * Verifies an AsyncJobCancelled message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AsyncJobCancelled message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AsyncJobCancelled
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AsyncJobCancelled;

                    /**
                     * Creates a plain object from an AsyncJobCancelled message. Also converts values to other types if specified.
                     * @param message AsyncJobCancelled
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AsyncJobCancelled, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AsyncJobCancelled to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AsyncJobCancelled
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** FinishReason enum. */
                enum FinishReason {
                    FINISH_REASON_UNSPECIFIED = 0,
                    FINISH_REASON_STOP = 1,
                    FINISH_REASON_LENGTH = 2,
                    FINISH_REASON_TOOL_CALLS = 3,
                    FINISH_REASON_CONTENT_FILTER = 4,
                    FINISH_REASON_ERROR = 5,
                    FINISH_REASON_VENDOR_SPECIFIC = 100
                }

                /** ContentBlockType enum. */
                enum ContentBlockType {
                    CONTENT_BLOCK_TYPE_UNSPECIFIED = 0,
                    CONTENT_BLOCK_TYPE_TEXT = 1,
                    CONTENT_BLOCK_TYPE_IMAGE = 2,
                    CONTENT_BLOCK_TYPE_AUDIO = 3,
                    CONTENT_BLOCK_TYPE_FILE = 4,
                    CONTENT_BLOCK_TYPE_TOOL_USE = 5,
                    CONTENT_BLOCK_TYPE_TOOL_RESULT = 6,
                    CONTENT_BLOCK_TYPE_THINKING = 7,
                    CONTENT_BLOCK_TYPE_VENDOR_SPECIFIC = 100
                }

                /** ReasoningEffort enum. */
                enum ReasoningEffort {
                    REASONING_EFFORT_UNSPECIFIED = 0,
                    REASONING_EFFORT_MINIMAL = 1,
                    REASONING_EFFORT_LOW = 2,
                    REASONING_EFFORT_MEDIUM = 3,
                    REASONING_EFFORT_HIGH = 4,
                    REASONING_EFFORT_MAX = 5
                }

                /** ReasoningVisibility enum. */
                enum ReasoningVisibility {
                    REASONING_VISIBILITY_UNSPECIFIED = 0,
                    REASONING_VISIBILITY_HIDDEN = 1,
                    REASONING_VISIBILITY_SUMMARY = 2,
                    REASONING_VISIBILITY_FULL = 3
                }

                /** ThreadStatus enum. */
                enum ThreadStatus {
                    THREAD_STATUS_UNSPECIFIED = 0,
                    THREAD_STATUS_ACTIVE = 1,
                    THREAD_STATUS_ARCHIVED = 2,
                    THREAD_STATUS_DELETED = 3,
                    THREAD_STATUS_VENDOR_SPECIFIC = 100
                }

                /** ThreadRunStatus enum. */
                enum ThreadRunStatus {
                    THREAD_RUN_STATUS_UNSPECIFIED = 0,
                    THREAD_RUN_STATUS_QUEUED = 1,
                    THREAD_RUN_STATUS_IN_PROGRESS = 2,
                    THREAD_RUN_STATUS_REQUIRES_ACTION = 3,
                    THREAD_RUN_STATUS_COMPLETED = 4,
                    THREAD_RUN_STATUS_FAILED = 5,
                    THREAD_RUN_STATUS_CANCELLED = 6,
                    THREAD_RUN_STATUS_EXPIRED = 7,
                    THREAD_RUN_STATUS_VENDOR_SPECIFIC = 100
                }

                /** AsyncJobType enum. */
                enum AsyncJobType {
                    ASYNC_JOB_TYPE_UNSPECIFIED = 0,
                    ASYNC_JOB_TYPE_BATCH_COMPLETION = 1,
                    ASYNC_JOB_TYPE_VENDOR_SPECIFIC = 100
                }

                /** AsyncJobStatus enum. */
                enum AsyncJobStatus {
                    ASYNC_JOB_STATUS_UNSPECIFIED = 0,
                    ASYNC_JOB_STATUS_VALIDATING = 1,
                    ASYNC_JOB_STATUS_QUEUED = 2,
                    ASYNC_JOB_STATUS_RUNNING = 3,
                    ASYNC_JOB_STATUS_FINALIZING = 4,
                    ASYNC_JOB_STATUS_COMPLETED = 5,
                    ASYNC_JOB_STATUS_FAILED = 6,
                    ASYNC_JOB_STATUS_CANCELLED = 7,
                    ASYNC_JOB_STATUS_EXPIRED = 8,
                    ASYNC_JOB_STATUS_VENDOR_SPECIFIC = 100
                }

                /** Properties of a TokenUsage. */
                interface ITokenUsage {

                    /** TokenUsage input_tokens */
                    input_tokens?: (number|null);

                    /** TokenUsage output_tokens */
                    output_tokens?: (number|null);

                    /** TokenUsage reasoning_tokens */
                    reasoning_tokens?: (number|null);

                    /** TokenUsage cached_tokens */
                    cached_tokens?: (number|null);

                    /** TokenUsage total_tokens */
                    total_tokens?: (number|null);
                }

                /** Represents a TokenUsage. */
                class TokenUsage implements ITokenUsage {

                    /**
                     * Constructs a new TokenUsage.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ITokenUsage);

                    /** TokenUsage input_tokens. */
                    public input_tokens: number;

                    /** TokenUsage output_tokens. */
                    public output_tokens: number;

                    /** TokenUsage reasoning_tokens. */
                    public reasoning_tokens: number;

                    /** TokenUsage cached_tokens. */
                    public cached_tokens: number;

                    /** TokenUsage total_tokens. */
                    public total_tokens: number;

                    /**
                     * Creates a new TokenUsage instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns TokenUsage instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ITokenUsage): rntme.contracts.ai_llm.v1.TokenUsage;

                    /**
                     * Encodes the specified TokenUsage message. Does not implicitly {@link rntme.contracts.ai_llm.v1.TokenUsage.verify|verify} messages.
                     * @param message TokenUsage message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ITokenUsage, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified TokenUsage message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.TokenUsage.verify|verify} messages.
                     * @param message TokenUsage message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ITokenUsage, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a TokenUsage message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns TokenUsage
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.TokenUsage;

                    /**
                     * Decodes a TokenUsage message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns TokenUsage
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.TokenUsage;

                    /**
                     * Verifies a TokenUsage message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a TokenUsage message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns TokenUsage
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.TokenUsage;

                    /**
                     * Creates a plain object from a TokenUsage message. Also converts values to other types if specified.
                     * @param message TokenUsage
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.TokenUsage, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this TokenUsage to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for TokenUsage
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SamplingParams. */
                interface ISamplingParams {

                    /** SamplingParams temperature */
                    temperature?: (number|null);

                    /** SamplingParams top_p */
                    top_p?: (number|null);

                    /** SamplingParams top_k */
                    top_k?: (number|null);

                    /** SamplingParams max_tokens */
                    max_tokens?: (number|null);

                    /** SamplingParams frequency_penalty */
                    frequency_penalty?: (number|null);

                    /** SamplingParams presence_penalty */
                    presence_penalty?: (number|null);

                    /** SamplingParams stop_sequences */
                    stop_sequences?: (string[]|null);

                    /** SamplingParams seed */
                    seed?: (number|Long|null);

                    /** SamplingParams response_format */
                    response_format?: (string|null);

                    /** SamplingParams response_schema */
                    response_schema?: (google.protobuf.IStruct|null);
                }

                /** Represents a SamplingParams. */
                class SamplingParams implements ISamplingParams {

                    /**
                     * Constructs a new SamplingParams.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ISamplingParams);

                    /** SamplingParams temperature. */
                    public temperature?: (number|null);

                    /** SamplingParams top_p. */
                    public top_p?: (number|null);

                    /** SamplingParams top_k. */
                    public top_k?: (number|null);

                    /** SamplingParams max_tokens. */
                    public max_tokens?: (number|null);

                    /** SamplingParams frequency_penalty. */
                    public frequency_penalty?: (number|null);

                    /** SamplingParams presence_penalty. */
                    public presence_penalty?: (number|null);

                    /** SamplingParams stop_sequences. */
                    public stop_sequences: string[];

                    /** SamplingParams seed. */
                    public seed?: (number|Long|null);

                    /** SamplingParams response_format. */
                    public response_format?: (string|null);

                    /** SamplingParams response_schema. */
                    public response_schema?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new SamplingParams instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SamplingParams instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ISamplingParams): rntme.contracts.ai_llm.v1.SamplingParams;

                    /**
                     * Encodes the specified SamplingParams message. Does not implicitly {@link rntme.contracts.ai_llm.v1.SamplingParams.verify|verify} messages.
                     * @param message SamplingParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ISamplingParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SamplingParams message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.SamplingParams.verify|verify} messages.
                     * @param message SamplingParams message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ISamplingParams, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SamplingParams message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SamplingParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.SamplingParams;

                    /**
                     * Decodes a SamplingParams message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SamplingParams
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.SamplingParams;

                    /**
                     * Verifies a SamplingParams message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SamplingParams message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SamplingParams
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.SamplingParams;

                    /**
                     * Creates a plain object from a SamplingParams message. Also converts values to other types if specified.
                     * @param message SamplingParams
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.SamplingParams, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SamplingParams to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SamplingParams
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ReasoningInfo. */
                interface IReasoningInfo {

                    /** ReasoningInfo effort */
                    effort?: (rntme.contracts.ai_llm.v1.ReasoningEffort|null);

                    /** ReasoningInfo visibility */
                    visibility?: (rntme.contracts.ai_llm.v1.ReasoningVisibility|null);

                    /** ReasoningInfo summary */
                    summary?: (string|null);
                }

                /** Represents a ReasoningInfo. */
                class ReasoningInfo implements IReasoningInfo {

                    /**
                     * Constructs a new ReasoningInfo.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IReasoningInfo);

                    /** ReasoningInfo effort. */
                    public effort: rntme.contracts.ai_llm.v1.ReasoningEffort;

                    /** ReasoningInfo visibility. */
                    public visibility: rntme.contracts.ai_llm.v1.ReasoningVisibility;

                    /** ReasoningInfo summary. */
                    public summary: string;

                    /**
                     * Creates a new ReasoningInfo instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ReasoningInfo instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IReasoningInfo): rntme.contracts.ai_llm.v1.ReasoningInfo;

                    /**
                     * Encodes the specified ReasoningInfo message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ReasoningInfo.verify|verify} messages.
                     * @param message ReasoningInfo message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IReasoningInfo, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ReasoningInfo message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ReasoningInfo.verify|verify} messages.
                     * @param message ReasoningInfo message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IReasoningInfo, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ReasoningInfo message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ReasoningInfo
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ReasoningInfo;

                    /**
                     * Decodes a ReasoningInfo message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ReasoningInfo
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ReasoningInfo;

                    /**
                     * Verifies a ReasoningInfo message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ReasoningInfo message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ReasoningInfo
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ReasoningInfo;

                    /**
                     * Creates a plain object from a ReasoningInfo message. Also converts values to other types if specified.
                     * @param message ReasoningInfo
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ReasoningInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ReasoningInfo to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ReasoningInfo
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ToolDefinition. */
                interface IToolDefinition {

                    /** ToolDefinition name */
                    name?: (string|null);

                    /** ToolDefinition description */
                    description?: (string|null);

                    /** ToolDefinition input_schema */
                    input_schema?: (google.protobuf.IStruct|null);

                    /** ToolDefinition strict */
                    strict?: (boolean|null);
                }

                /** Represents a ToolDefinition. */
                class ToolDefinition implements IToolDefinition {

                    /**
                     * Constructs a new ToolDefinition.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IToolDefinition);

                    /** ToolDefinition name. */
                    public name: string;

                    /** ToolDefinition description. */
                    public description: string;

                    /** ToolDefinition input_schema. */
                    public input_schema?: (google.protobuf.IStruct|null);

                    /** ToolDefinition strict. */
                    public strict: boolean;

                    /**
                     * Creates a new ToolDefinition instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ToolDefinition instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IToolDefinition): rntme.contracts.ai_llm.v1.ToolDefinition;

                    /**
                     * Encodes the specified ToolDefinition message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ToolDefinition.verify|verify} messages.
                     * @param message ToolDefinition message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IToolDefinition, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ToolDefinition message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ToolDefinition.verify|verify} messages.
                     * @param message ToolDefinition message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IToolDefinition, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ToolDefinition message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ToolDefinition
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ToolDefinition;

                    /**
                     * Decodes a ToolDefinition message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ToolDefinition
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ToolDefinition;

                    /**
                     * Verifies a ToolDefinition message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ToolDefinition message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ToolDefinition
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ToolDefinition;

                    /**
                     * Creates a plain object from a ToolDefinition message. Also converts values to other types if specified.
                     * @param message ToolDefinition
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ToolDefinition, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ToolDefinition to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ToolDefinition
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ToolCall. */
                interface IToolCall {

                    /** ToolCall id */
                    id?: (string|null);

                    /** ToolCall name */
                    name?: (string|null);

                    /** ToolCall arguments */
                    "arguments"?: (google.protobuf.IStruct|null);
                }

                /** Represents a ToolCall. */
                class ToolCall implements IToolCall {

                    /**
                     * Constructs a new ToolCall.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IToolCall);

                    /** ToolCall id. */
                    public id: string;

                    /** ToolCall name. */
                    public name: string;

                    /** ToolCall arguments. */
                    public arguments?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new ToolCall instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ToolCall instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IToolCall): rntme.contracts.ai_llm.v1.ToolCall;

                    /**
                     * Encodes the specified ToolCall message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ToolCall.verify|verify} messages.
                     * @param message ToolCall message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IToolCall, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ToolCall message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ToolCall.verify|verify} messages.
                     * @param message ToolCall message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IToolCall, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ToolCall message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ToolCall
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ToolCall;

                    /**
                     * Decodes a ToolCall message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ToolCall
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ToolCall;

                    /**
                     * Verifies a ToolCall message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ToolCall message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ToolCall
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ToolCall;

                    /**
                     * Creates a plain object from a ToolCall message. Also converts values to other types if specified.
                     * @param message ToolCall
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ToolCall, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ToolCall to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ToolCall
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ToolResult. */
                interface IToolResult {

                    /** ToolResult tool_call_id */
                    tool_call_id?: (string|null);

                    /** ToolResult output */
                    output?: (google.protobuf.IStruct|null);

                    /** ToolResult is_error */
                    is_error?: (boolean|null);
                }

                /** Represents a ToolResult. */
                class ToolResult implements IToolResult {

                    /**
                     * Constructs a new ToolResult.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IToolResult);

                    /** ToolResult tool_call_id. */
                    public tool_call_id: string;

                    /** ToolResult output. */
                    public output?: (google.protobuf.IStruct|null);

                    /** ToolResult is_error. */
                    public is_error: boolean;

                    /**
                     * Creates a new ToolResult instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ToolResult instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IToolResult): rntme.contracts.ai_llm.v1.ToolResult;

                    /**
                     * Encodes the specified ToolResult message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ToolResult.verify|verify} messages.
                     * @param message ToolResult message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IToolResult, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ToolResult message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ToolResult.verify|verify} messages.
                     * @param message ToolResult message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IToolResult, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ToolResult message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ToolResult
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ToolResult;

                    /**
                     * Decodes a ToolResult message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ToolResult
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ToolResult;

                    /**
                     * Verifies a ToolResult message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ToolResult message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ToolResult
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ToolResult;

                    /**
                     * Creates a plain object from a ToolResult message. Also converts values to other types if specified.
                     * @param message ToolResult
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ToolResult, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ToolResult to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ToolResult
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Message. */
                interface IMessage {

                    /** Message role */
                    role?: (string|null);

                    /** Message content */
                    content?: (rntme.contracts.ai_llm.v1.IContentBlock[]|null);
                }

                /** Represents a Message. */
                class Message implements IMessage {

                    /**
                     * Constructs a new Message.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IMessage);

                    /** Message role. */
                    public role: string;

                    /** Message content. */
                    public content: rntme.contracts.ai_llm.v1.IContentBlock[];

                    /**
                     * Creates a new Message instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Message instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IMessage): rntme.contracts.ai_llm.v1.Message;

                    /**
                     * Encodes the specified Message message. Does not implicitly {@link rntme.contracts.ai_llm.v1.Message.verify|verify} messages.
                     * @param message Message message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IMessage, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Message message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.Message.verify|verify} messages.
                     * @param message Message message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IMessage, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Message message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Message
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.Message;

                    /**
                     * Decodes a Message message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Message
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.Message;

                    /**
                     * Verifies a Message message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Message message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Message
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.Message;

                    /**
                     * Creates a plain object from a Message message. Also converts values to other types if specified.
                     * @param message Message
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.Message, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Message to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Message
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ContentBlock. */
                interface IContentBlock {

                    /** ContentBlock type */
                    type?: (rntme.contracts.ai_llm.v1.ContentBlockType|null);

                    /** ContentBlock text */
                    text?: (rntme.contracts.ai_llm.v1.ITextBlock|null);

                    /** ContentBlock image */
                    image?: (rntme.contracts.ai_llm.v1.IImageBlock|null);

                    /** ContentBlock audio */
                    audio?: (rntme.contracts.ai_llm.v1.IAudioBlock|null);

                    /** ContentBlock file */
                    file?: (rntme.contracts.ai_llm.v1.IFileBlock|null);

                    /** ContentBlock tool_use */
                    tool_use?: (rntme.contracts.ai_llm.v1.IToolCall|null);

                    /** ContentBlock tool_result */
                    tool_result?: (rntme.contracts.ai_llm.v1.IToolResult|null);

                    /** ContentBlock thinking */
                    thinking?: (rntme.contracts.ai_llm.v1.IThinkingBlock|null);
                }

                /** Represents a ContentBlock. */
                class ContentBlock implements IContentBlock {

                    /**
                     * Constructs a new ContentBlock.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IContentBlock);

                    /** ContentBlock type. */
                    public type: rntme.contracts.ai_llm.v1.ContentBlockType;

                    /** ContentBlock text. */
                    public text?: (rntme.contracts.ai_llm.v1.ITextBlock|null);

                    /** ContentBlock image. */
                    public image?: (rntme.contracts.ai_llm.v1.IImageBlock|null);

                    /** ContentBlock audio. */
                    public audio?: (rntme.contracts.ai_llm.v1.IAudioBlock|null);

                    /** ContentBlock file. */
                    public file?: (rntme.contracts.ai_llm.v1.IFileBlock|null);

                    /** ContentBlock tool_use. */
                    public tool_use?: (rntme.contracts.ai_llm.v1.IToolCall|null);

                    /** ContentBlock tool_result. */
                    public tool_result?: (rntme.contracts.ai_llm.v1.IToolResult|null);

                    /** ContentBlock thinking. */
                    public thinking?: (rntme.contracts.ai_llm.v1.IThinkingBlock|null);

                    /** ContentBlock body. */
                    public body?: ("text"|"image"|"audio"|"file"|"tool_use"|"tool_result"|"thinking");

                    /**
                     * Creates a new ContentBlock instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ContentBlock instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IContentBlock): rntme.contracts.ai_llm.v1.ContentBlock;

                    /**
                     * Encodes the specified ContentBlock message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ContentBlock.verify|verify} messages.
                     * @param message ContentBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IContentBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ContentBlock message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ContentBlock.verify|verify} messages.
                     * @param message ContentBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IContentBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ContentBlock message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ContentBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ContentBlock;

                    /**
                     * Decodes a ContentBlock message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ContentBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ContentBlock;

                    /**
                     * Verifies a ContentBlock message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ContentBlock message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ContentBlock
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ContentBlock;

                    /**
                     * Creates a plain object from a ContentBlock message. Also converts values to other types if specified.
                     * @param message ContentBlock
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ContentBlock, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ContentBlock to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ContentBlock
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a TextBlock. */
                interface ITextBlock {

                    /** TextBlock text */
                    text?: (string|null);
                }

                /** Represents a TextBlock. */
                class TextBlock implements ITextBlock {

                    /**
                     * Constructs a new TextBlock.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ITextBlock);

                    /** TextBlock text. */
                    public text: string;

                    /**
                     * Creates a new TextBlock instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns TextBlock instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ITextBlock): rntme.contracts.ai_llm.v1.TextBlock;

                    /**
                     * Encodes the specified TextBlock message. Does not implicitly {@link rntme.contracts.ai_llm.v1.TextBlock.verify|verify} messages.
                     * @param message TextBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ITextBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified TextBlock message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.TextBlock.verify|verify} messages.
                     * @param message TextBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ITextBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a TextBlock message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns TextBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.TextBlock;

                    /**
                     * Decodes a TextBlock message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns TextBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.TextBlock;

                    /**
                     * Verifies a TextBlock message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a TextBlock message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns TextBlock
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.TextBlock;

                    /**
                     * Creates a plain object from a TextBlock message. Also converts values to other types if specified.
                     * @param message TextBlock
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.TextBlock, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this TextBlock to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for TextBlock
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ImageBlock. */
                interface IImageBlock {

                    /** ImageBlock url */
                    url?: (string|null);

                    /** ImageBlock base64_data */
                    base64_data?: (Uint8Array|null);

                    /** ImageBlock media_type */
                    media_type?: (string|null);
                }

                /** Represents an ImageBlock. */
                class ImageBlock implements IImageBlock {

                    /**
                     * Constructs a new ImageBlock.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IImageBlock);

                    /** ImageBlock url. */
                    public url?: (string|null);

                    /** ImageBlock base64_data. */
                    public base64_data?: (Uint8Array|null);

                    /** ImageBlock media_type. */
                    public media_type: string;

                    /** ImageBlock source. */
                    public source?: ("url"|"base64_data");

                    /**
                     * Creates a new ImageBlock instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ImageBlock instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IImageBlock): rntme.contracts.ai_llm.v1.ImageBlock;

                    /**
                     * Encodes the specified ImageBlock message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ImageBlock.verify|verify} messages.
                     * @param message ImageBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IImageBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ImageBlock message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ImageBlock.verify|verify} messages.
                     * @param message ImageBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IImageBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an ImageBlock message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ImageBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ImageBlock;

                    /**
                     * Decodes an ImageBlock message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ImageBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ImageBlock;

                    /**
                     * Verifies an ImageBlock message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an ImageBlock message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ImageBlock
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ImageBlock;

                    /**
                     * Creates a plain object from an ImageBlock message. Also converts values to other types if specified.
                     * @param message ImageBlock
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ImageBlock, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ImageBlock to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ImageBlock
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AudioBlock. */
                interface IAudioBlock {

                    /** AudioBlock url */
                    url?: (string|null);

                    /** AudioBlock base64_data */
                    base64_data?: (Uint8Array|null);

                    /** AudioBlock media_type */
                    media_type?: (string|null);

                    /** AudioBlock transcript */
                    transcript?: (string|null);
                }

                /** Represents an AudioBlock. */
                class AudioBlock implements IAudioBlock {

                    /**
                     * Constructs a new AudioBlock.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAudioBlock);

                    /** AudioBlock url. */
                    public url?: (string|null);

                    /** AudioBlock base64_data. */
                    public base64_data?: (Uint8Array|null);

                    /** AudioBlock media_type. */
                    public media_type: string;

                    /** AudioBlock transcript. */
                    public transcript: string;

                    /** AudioBlock source. */
                    public source?: ("url"|"base64_data");

                    /**
                     * Creates a new AudioBlock instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AudioBlock instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAudioBlock): rntme.contracts.ai_llm.v1.AudioBlock;

                    /**
                     * Encodes the specified AudioBlock message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AudioBlock.verify|verify} messages.
                     * @param message AudioBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAudioBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AudioBlock message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AudioBlock.verify|verify} messages.
                     * @param message AudioBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAudioBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AudioBlock message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AudioBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AudioBlock;

                    /**
                     * Decodes an AudioBlock message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AudioBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AudioBlock;

                    /**
                     * Verifies an AudioBlock message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AudioBlock message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AudioBlock
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AudioBlock;

                    /**
                     * Creates a plain object from an AudioBlock message. Also converts values to other types if specified.
                     * @param message AudioBlock
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AudioBlock, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AudioBlock to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AudioBlock
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a FileBlock. */
                interface IFileBlock {

                    /** FileBlock url */
                    url?: (string|null);

                    /** FileBlock base64_data */
                    base64_data?: (Uint8Array|null);

                    /** FileBlock vendor_file_id */
                    vendor_file_id?: (string|null);

                    /** FileBlock media_type */
                    media_type?: (string|null);

                    /** FileBlock filename */
                    filename?: (string|null);
                }

                /** Represents a FileBlock. */
                class FileBlock implements IFileBlock {

                    /**
                     * Constructs a new FileBlock.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IFileBlock);

                    /** FileBlock url. */
                    public url?: (string|null);

                    /** FileBlock base64_data. */
                    public base64_data?: (Uint8Array|null);

                    /** FileBlock vendor_file_id. */
                    public vendor_file_id?: (string|null);

                    /** FileBlock media_type. */
                    public media_type: string;

                    /** FileBlock filename. */
                    public filename: string;

                    /** FileBlock source. */
                    public source?: ("url"|"base64_data"|"vendor_file_id");

                    /**
                     * Creates a new FileBlock instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FileBlock instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IFileBlock): rntme.contracts.ai_llm.v1.FileBlock;

                    /**
                     * Encodes the specified FileBlock message. Does not implicitly {@link rntme.contracts.ai_llm.v1.FileBlock.verify|verify} messages.
                     * @param message FileBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IFileBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FileBlock message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.FileBlock.verify|verify} messages.
                     * @param message FileBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IFileBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FileBlock message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FileBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.FileBlock;

                    /**
                     * Decodes a FileBlock message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FileBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.FileBlock;

                    /**
                     * Verifies a FileBlock message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FileBlock message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FileBlock
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.FileBlock;

                    /**
                     * Creates a plain object from a FileBlock message. Also converts values to other types if specified.
                     * @param message FileBlock
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.FileBlock, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FileBlock to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FileBlock
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThinkingBlock. */
                interface IThinkingBlock {

                    /** ThinkingBlock text */
                    text?: (string|null);

                    /** ThinkingBlock redacted */
                    redacted?: (boolean|null);
                }

                /** Represents a ThinkingBlock. */
                class ThinkingBlock implements IThinkingBlock {

                    /**
                     * Constructs a new ThinkingBlock.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThinkingBlock);

                    /** ThinkingBlock text. */
                    public text: string;

                    /** ThinkingBlock redacted. */
                    public redacted: boolean;

                    /**
                     * Creates a new ThinkingBlock instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThinkingBlock instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThinkingBlock): rntme.contracts.ai_llm.v1.ThinkingBlock;

                    /**
                     * Encodes the specified ThinkingBlock message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThinkingBlock.verify|verify} messages.
                     * @param message ThinkingBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThinkingBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThinkingBlock message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThinkingBlock.verify|verify} messages.
                     * @param message ThinkingBlock message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThinkingBlock, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThinkingBlock message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThinkingBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThinkingBlock;

                    /**
                     * Decodes a ThinkingBlock message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThinkingBlock
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThinkingBlock;

                    /**
                     * Verifies a ThinkingBlock message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThinkingBlock message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThinkingBlock
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThinkingBlock;

                    /**
                     * Creates a plain object from a ThinkingBlock message. Also converts values to other types if specified.
                     * @param message ThinkingBlock
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThinkingBlock, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThinkingBlock to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThinkingBlock
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Completion. */
                interface ICompletion {

                    /** Completion ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Completion model */
                    model?: (string|null);

                    /** Completion content */
                    content?: (rntme.contracts.ai_llm.v1.IContentBlock[]|null);

                    /** Completion finish_reason */
                    finish_reason?: (rntme.contracts.ai_llm.v1.FinishReason|null);

                    /** Completion usage */
                    usage?: (rntme.contracts.ai_llm.v1.ITokenUsage|null);

                    /** Completion reasoning */
                    reasoning?: (rntme.contracts.ai_llm.v1.IReasoningInfo|null);

                    /** Completion tool_calls */
                    tool_calls?: (rntme.contracts.ai_llm.v1.IToolCall[]|null);

                    /** Completion started_at */
                    started_at?: (google.protobuf.ITimestamp|null);

                    /** Completion finished_at */
                    finished_at?: (google.protobuf.ITimestamp|null);

                    /** Completion time_to_first_token */
                    time_to_first_token?: (google.protobuf.IDuration|null);

                    /** Completion vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a Completion. */
                class Completion implements ICompletion {

                    /**
                     * Constructs a new Completion.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ICompletion);

                    /** Completion ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** Completion model. */
                    public model: string;

                    /** Completion content. */
                    public content: rntme.contracts.ai_llm.v1.IContentBlock[];

                    /** Completion finish_reason. */
                    public finish_reason: rntme.contracts.ai_llm.v1.FinishReason;

                    /** Completion usage. */
                    public usage?: (rntme.contracts.ai_llm.v1.ITokenUsage|null);

                    /** Completion reasoning. */
                    public reasoning?: (rntme.contracts.ai_llm.v1.IReasoningInfo|null);

                    /** Completion tool_calls. */
                    public tool_calls: rntme.contracts.ai_llm.v1.IToolCall[];

                    /** Completion started_at. */
                    public started_at?: (google.protobuf.ITimestamp|null);

                    /** Completion finished_at. */
                    public finished_at?: (google.protobuf.ITimestamp|null);

                    /** Completion time_to_first_token. */
                    public time_to_first_token?: (google.protobuf.IDuration|null);

                    /** Completion vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new Completion instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Completion instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ICompletion): rntme.contracts.ai_llm.v1.Completion;

                    /**
                     * Encodes the specified Completion message. Does not implicitly {@link rntme.contracts.ai_llm.v1.Completion.verify|verify} messages.
                     * @param message Completion message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ICompletion, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Completion message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.Completion.verify|verify} messages.
                     * @param message Completion message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ICompletion, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Completion message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Completion
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.Completion;

                    /**
                     * Decodes a Completion message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Completion
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.Completion;

                    /**
                     * Verifies a Completion message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Completion message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Completion
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.Completion;

                    /**
                     * Creates a plain object from a Completion message. Also converts values to other types if specified.
                     * @param message Completion
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.Completion, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Completion to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Completion
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AssistantThread. */
                interface IAssistantThread {

                    /** AssistantThread ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** AssistantThread title */
                    title?: (string|null);

                    /** AssistantThread status */
                    status?: (rntme.contracts.ai_llm.v1.ThreadStatus|null);

                    /** AssistantThread metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** AssistantThread created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** AssistantThread updated_at */
                    updated_at?: (google.protobuf.ITimestamp|null);

                    /** AssistantThread vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents an AssistantThread. */
                class AssistantThread implements IAssistantThread {

                    /**
                     * Constructs a new AssistantThread.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAssistantThread);

                    /** AssistantThread ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** AssistantThread title. */
                    public title: string;

                    /** AssistantThread status. */
                    public status: rntme.contracts.ai_llm.v1.ThreadStatus;

                    /** AssistantThread metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** AssistantThread created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** AssistantThread updated_at. */
                    public updated_at?: (google.protobuf.ITimestamp|null);

                    /** AssistantThread vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new AssistantThread instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AssistantThread instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAssistantThread): rntme.contracts.ai_llm.v1.AssistantThread;

                    /**
                     * Encodes the specified AssistantThread message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AssistantThread.verify|verify} messages.
                     * @param message AssistantThread message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAssistantThread, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AssistantThread message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AssistantThread.verify|verify} messages.
                     * @param message AssistantThread message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAssistantThread, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AssistantThread message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AssistantThread
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AssistantThread;

                    /**
                     * Decodes an AssistantThread message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AssistantThread
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AssistantThread;

                    /**
                     * Verifies an AssistantThread message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AssistantThread message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AssistantThread
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AssistantThread;

                    /**
                     * Creates a plain object from an AssistantThread message. Also converts values to other types if specified.
                     * @param message AssistantThread
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AssistantThread, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AssistantThread to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AssistantThread
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadItem. */
                interface IThreadItem {

                    /** ThreadItem item_id */
                    item_id?: (string|null);

                    /** ThreadItem thread_id */
                    thread_id?: (string|null);

                    /** ThreadItem role */
                    role?: (string|null);

                    /** ThreadItem content */
                    content?: (rntme.contracts.ai_llm.v1.IContentBlock[]|null);

                    /** ThreadItem created_at */
                    created_at?: (google.protobuf.ITimestamp|null);

                    /** ThreadItem run_id */
                    run_id?: (string|null);

                    /** ThreadItem vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a ThreadItem. */
                class ThreadItem implements IThreadItem {

                    /**
                     * Constructs a new ThreadItem.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadItem);

                    /** ThreadItem item_id. */
                    public item_id: string;

                    /** ThreadItem thread_id. */
                    public thread_id: string;

                    /** ThreadItem role. */
                    public role: string;

                    /** ThreadItem content. */
                    public content: rntme.contracts.ai_llm.v1.IContentBlock[];

                    /** ThreadItem created_at. */
                    public created_at?: (google.protobuf.ITimestamp|null);

                    /** ThreadItem run_id. */
                    public run_id: string;

                    /** ThreadItem vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new ThreadItem instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadItem instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadItem): rntme.contracts.ai_llm.v1.ThreadItem;

                    /**
                     * Encodes the specified ThreadItem message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadItem.verify|verify} messages.
                     * @param message ThreadItem message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadItem, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadItem message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadItem.verify|verify} messages.
                     * @param message ThreadItem message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadItem, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadItem message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadItem
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadItem;

                    /**
                     * Decodes a ThreadItem message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadItem
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadItem;

                    /**
                     * Verifies a ThreadItem message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadItem message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadItem
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadItem;

                    /**
                     * Creates a plain object from a ThreadItem message. Also converts values to other types if specified.
                     * @param message ThreadItem
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadItem, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadItem to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadItem
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadRun. */
                interface IThreadRun {

                    /** ThreadRun ref */
                    ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** ThreadRun thread_id */
                    thread_id?: (string|null);

                    /** ThreadRun status */
                    status?: (rntme.contracts.ai_llm.v1.ThreadRunStatus|null);

                    /** ThreadRun model */
                    model?: (string|null);

                    /** ThreadRun usage */
                    usage?: (rntme.contracts.ai_llm.v1.ITokenUsage|null);

                    /** ThreadRun required_tool_calls */
                    required_tool_calls?: (rntme.contracts.ai_llm.v1.IToolCall[]|null);

                    /** ThreadRun reasoning */
                    reasoning?: (rntme.contracts.ai_llm.v1.IReasoningInfo|null);

                    /** ThreadRun failure_reason */
                    failure_reason?: (string|null);

                    /** ThreadRun started_at */
                    started_at?: (google.protobuf.ITimestamp|null);

                    /** ThreadRun completed_at */
                    completed_at?: (google.protobuf.ITimestamp|null);

                    /** ThreadRun vendor_raw */
                    vendor_raw?: (google.protobuf.IStruct|null);
                }

                /** Represents a ThreadRun. */
                class ThreadRun implements IThreadRun {

                    /**
                     * Constructs a new ThreadRun.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadRun);

                    /** ThreadRun ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** ThreadRun thread_id. */
                    public thread_id: string;

                    /** ThreadRun status. */
                    public status: rntme.contracts.ai_llm.v1.ThreadRunStatus;

                    /** ThreadRun model. */
                    public model: string;

                    /** ThreadRun usage. */
                    public usage?: (rntme.contracts.ai_llm.v1.ITokenUsage|null);

                    /** ThreadRun required_tool_calls. */
                    public required_tool_calls: rntme.contracts.ai_llm.v1.IToolCall[];

                    /** ThreadRun reasoning. */
                    public reasoning?: (rntme.contracts.ai_llm.v1.IReasoningInfo|null);

                    /** ThreadRun failure_reason. */
                    public failure_reason: string;

                    /** ThreadRun started_at. */
                    public started_at?: (google.protobuf.ITimestamp|null);

                    /** ThreadRun completed_at. */
                    public completed_at?: (google.protobuf.ITimestamp|null);

                    /** ThreadRun vendor_raw. */
                    public vendor_raw?: (google.protobuf.IStruct|null);

                    /**
                     * Creates a new ThreadRun instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadRun instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadRun): rntme.contracts.ai_llm.v1.ThreadRun;

                    /**
                     * Encodes the specified ThreadRun message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRun.verify|verify} messages.
                     * @param message ThreadRun message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadRun, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadRun message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadRun.verify|verify} messages.
                     * @param message ThreadRun message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadRun, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadRun message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadRun
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadRun;

                    /**
                     * Decodes a ThreadRun message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadRun
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadRun;

                    /**
                     * Verifies a ThreadRun message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadRun message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadRun
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadRun;

                    /**
                     * Creates a plain object from a ThreadRun message. Also converts values to other types if specified.
                     * @param message ThreadRun
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadRun, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadRun to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadRun
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
                    type?: (rntme.contracts.ai_llm.v1.AsyncJobType|null);

                    /** AsyncJob status */
                    status?: (rntme.contracts.ai_llm.v1.AsyncJobStatus|null);

                    /** AsyncJob progress_percentage */
                    progress_percentage?: (number|null);

                    /** AsyncJob result_uri */
                    result_uri?: (string|null);

                    /** AsyncJob error_message */
                    error_message?: (string|null);

                    /** AsyncJob aggregate_usage */
                    aggregate_usage?: (rntme.contracts.ai_llm.v1.ITokenUsage|null);

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
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAsyncJob);

                    /** AsyncJob ref. */
                    public ref?: (rntme.contracts.common.v1.ICanonicalRef|null);

                    /** AsyncJob type. */
                    public type: rntme.contracts.ai_llm.v1.AsyncJobType;

                    /** AsyncJob status. */
                    public status: rntme.contracts.ai_llm.v1.AsyncJobStatus;

                    /** AsyncJob progress_percentage. */
                    public progress_percentage: number;

                    /** AsyncJob result_uri. */
                    public result_uri: string;

                    /** AsyncJob error_message. */
                    public error_message: string;

                    /** AsyncJob aggregate_usage. */
                    public aggregate_usage?: (rntme.contracts.ai_llm.v1.ITokenUsage|null);

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
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAsyncJob): rntme.contracts.ai_llm.v1.AsyncJob;

                    /**
                     * Encodes the specified AsyncJob message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJob.verify|verify} messages.
                     * @param message AsyncJob message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAsyncJob, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJob message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJob.verify|verify} messages.
                     * @param message AsyncJob message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAsyncJob, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJob message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJob
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AsyncJob;

                    /**
                     * Decodes an AsyncJob message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJob
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AsyncJob;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AsyncJob;

                    /**
                     * Creates a plain object from an AsyncJob message. Also converts values to other types if specified.
                     * @param message AsyncJob
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AsyncJob, options?: $protobuf.IConversionOptions): { [k: string]: any };

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

                /** Properties of a BatchCompletionPayload. */
                interface IBatchCompletionPayload {

                    /** BatchCompletionPayload items */
                    items?: (rntme.contracts.ai_llm.v1.IBatchCompletionItem[]|null);

                    /** BatchCompletionPayload completion_window */
                    completion_window?: (string|null);
                }

                /** Represents a BatchCompletionPayload. */
                class BatchCompletionPayload implements IBatchCompletionPayload {

                    /**
                     * Constructs a new BatchCompletionPayload.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IBatchCompletionPayload);

                    /** BatchCompletionPayload items. */
                    public items: rntme.contracts.ai_llm.v1.IBatchCompletionItem[];

                    /** BatchCompletionPayload completion_window. */
                    public completion_window: string;

                    /**
                     * Creates a new BatchCompletionPayload instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns BatchCompletionPayload instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IBatchCompletionPayload): rntme.contracts.ai_llm.v1.BatchCompletionPayload;

                    /**
                     * Encodes the specified BatchCompletionPayload message. Does not implicitly {@link rntme.contracts.ai_llm.v1.BatchCompletionPayload.verify|verify} messages.
                     * @param message BatchCompletionPayload message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IBatchCompletionPayload, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified BatchCompletionPayload message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.BatchCompletionPayload.verify|verify} messages.
                     * @param message BatchCompletionPayload message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IBatchCompletionPayload, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a BatchCompletionPayload message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns BatchCompletionPayload
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.BatchCompletionPayload;

                    /**
                     * Decodes a BatchCompletionPayload message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns BatchCompletionPayload
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.BatchCompletionPayload;

                    /**
                     * Verifies a BatchCompletionPayload message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a BatchCompletionPayload message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns BatchCompletionPayload
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.BatchCompletionPayload;

                    /**
                     * Creates a plain object from a BatchCompletionPayload message. Also converts values to other types if specified.
                     * @param message BatchCompletionPayload
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.BatchCompletionPayload, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this BatchCompletionPayload to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for BatchCompletionPayload
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a BatchCompletionItem. */
                interface IBatchCompletionItem {

                    /** BatchCompletionItem custom_id */
                    custom_id?: (string|null);

                    /** BatchCompletionItem request */
                    request?: (rntme.contracts.ai_llm.v1.ICreateCompletionRequest|null);
                }

                /** Represents a BatchCompletionItem. */
                class BatchCompletionItem implements IBatchCompletionItem {

                    /**
                     * Constructs a new BatchCompletionItem.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IBatchCompletionItem);

                    /** BatchCompletionItem custom_id. */
                    public custom_id: string;

                    /** BatchCompletionItem request. */
                    public request?: (rntme.contracts.ai_llm.v1.ICreateCompletionRequest|null);

                    /**
                     * Creates a new BatchCompletionItem instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns BatchCompletionItem instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IBatchCompletionItem): rntme.contracts.ai_llm.v1.BatchCompletionItem;

                    /**
                     * Encodes the specified BatchCompletionItem message. Does not implicitly {@link rntme.contracts.ai_llm.v1.BatchCompletionItem.verify|verify} messages.
                     * @param message BatchCompletionItem message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IBatchCompletionItem, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified BatchCompletionItem message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.BatchCompletionItem.verify|verify} messages.
                     * @param message BatchCompletionItem message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IBatchCompletionItem, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a BatchCompletionItem message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns BatchCompletionItem
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.BatchCompletionItem;

                    /**
                     * Decodes a BatchCompletionItem message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns BatchCompletionItem
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.BatchCompletionItem;

                    /**
                     * Verifies a BatchCompletionItem message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a BatchCompletionItem message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns BatchCompletionItem
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.BatchCompletionItem;

                    /**
                     * Creates a plain object from a BatchCompletionItem message. Also converts values to other types if specified.
                     * @param message BatchCompletionItem
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.BatchCompletionItem, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this BatchCompletionItem to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for BatchCompletionItem
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Represents an AiLlmModule */
                class AiLlmModule extends $protobuf.rpc.Service {

                    /**
                     * Constructs a new AiLlmModule service.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     */
                    constructor(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean);

                    /**
                     * Creates new AiLlmModule service using the specified rpc implementation.
                     * @param rpcImpl RPC implementation
                     * @param [requestDelimited=false] Whether requests are length-delimited
                     * @param [responseDelimited=false] Whether responses are length-delimited
                     * @returns RPC service. Useful where requests and/or responses are streamed.
                     */
                    public static create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): AiLlmModule;

                    /**
                     * Calls Complete.
                     * @param request CreateCompletionRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Completion
                     */
                    public complete(request: rntme.contracts.ai_llm.v1.ICreateCompletionRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.CompleteCallback): void;

                    /**
                     * Calls Complete.
                     * @param request CreateCompletionRequest message or plain object
                     * @returns Promise
                     */
                    public complete(request: rntme.contracts.ai_llm.v1.ICreateCompletionRequest): Promise<rntme.contracts.ai_llm.v1.Completion>;

                    /**
                     * Calls GetCompletion.
                     * @param request GetCompletionRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and Completion
                     */
                    public getCompletion(request: rntme.contracts.ai_llm.v1.IGetCompletionRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.GetCompletionCallback): void;

                    /**
                     * Calls GetCompletion.
                     * @param request GetCompletionRequest message or plain object
                     * @returns Promise
                     */
                    public getCompletion(request: rntme.contracts.ai_llm.v1.IGetCompletionRequest): Promise<rntme.contracts.ai_llm.v1.Completion>;

                    /**
                     * Calls CreateThread.
                     * @param request CreateThreadRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AssistantThread
                     */
                    public createThread(request: rntme.contracts.ai_llm.v1.ICreateThreadRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.CreateThreadCallback): void;

                    /**
                     * Calls CreateThread.
                     * @param request CreateThreadRequest message or plain object
                     * @returns Promise
                     */
                    public createThread(request: rntme.contracts.ai_llm.v1.ICreateThreadRequest): Promise<rntme.contracts.ai_llm.v1.AssistantThread>;

                    /**
                     * Calls GetThread.
                     * @param request GetThreadRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AssistantThread
                     */
                    public getThread(request: rntme.contracts.ai_llm.v1.IGetThreadRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.GetThreadCallback): void;

                    /**
                     * Calls GetThread.
                     * @param request GetThreadRequest message or plain object
                     * @returns Promise
                     */
                    public getThread(request: rntme.contracts.ai_llm.v1.IGetThreadRequest): Promise<rntme.contracts.ai_llm.v1.AssistantThread>;

                    /**
                     * Calls DeleteThread.
                     * @param request DeleteThreadRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AssistantThread
                     */
                    public deleteThread(request: rntme.contracts.ai_llm.v1.IDeleteThreadRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.DeleteThreadCallback): void;

                    /**
                     * Calls DeleteThread.
                     * @param request DeleteThreadRequest message or plain object
                     * @returns Promise
                     */
                    public deleteThread(request: rntme.contracts.ai_llm.v1.IDeleteThreadRequest): Promise<rntme.contracts.ai_llm.v1.AssistantThread>;

                    /**
                     * Calls AddMessage.
                     * @param request AddMessageRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ThreadItem
                     */
                    public addMessage(request: rntme.contracts.ai_llm.v1.IAddMessageRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.AddMessageCallback): void;

                    /**
                     * Calls AddMessage.
                     * @param request AddMessageRequest message or plain object
                     * @returns Promise
                     */
                    public addMessage(request: rntme.contracts.ai_llm.v1.IAddMessageRequest): Promise<rntme.contracts.ai_llm.v1.ThreadItem>;

                    /**
                     * Calls ListThreadItems.
                     * @param request ListThreadItemsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ThreadItemList
                     */
                    public listThreadItems(request: rntme.contracts.ai_llm.v1.IListThreadItemsRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.ListThreadItemsCallback): void;

                    /**
                     * Calls ListThreadItems.
                     * @param request ListThreadItemsRequest message or plain object
                     * @returns Promise
                     */
                    public listThreadItems(request: rntme.contracts.ai_llm.v1.IListThreadItemsRequest): Promise<rntme.contracts.ai_llm.v1.ThreadItemList>;

                    /**
                     * Calls RunThread.
                     * @param request RunThreadRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ThreadRun
                     */
                    public runThread(request: rntme.contracts.ai_llm.v1.IRunThreadRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.RunThreadCallback): void;

                    /**
                     * Calls RunThread.
                     * @param request RunThreadRequest message or plain object
                     * @returns Promise
                     */
                    public runThread(request: rntme.contracts.ai_llm.v1.IRunThreadRequest): Promise<rntme.contracts.ai_llm.v1.ThreadRun>;

                    /**
                     * Calls GetThreadRun.
                     * @param request GetThreadRunRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ThreadRun
                     */
                    public getThreadRun(request: rntme.contracts.ai_llm.v1.IGetThreadRunRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.GetThreadRunCallback): void;

                    /**
                     * Calls GetThreadRun.
                     * @param request GetThreadRunRequest message or plain object
                     * @returns Promise
                     */
                    public getThreadRun(request: rntme.contracts.ai_llm.v1.IGetThreadRunRequest): Promise<rntme.contracts.ai_llm.v1.ThreadRun>;

                    /**
                     * Calls CancelThreadRun.
                     * @param request CancelThreadRunRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and ThreadRun
                     */
                    public cancelThreadRun(request: rntme.contracts.ai_llm.v1.ICancelThreadRunRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.CancelThreadRunCallback): void;

                    /**
                     * Calls CancelThreadRun.
                     * @param request CancelThreadRunRequest message or plain object
                     * @returns Promise
                     */
                    public cancelThreadRun(request: rntme.contracts.ai_llm.v1.ICancelThreadRunRequest): Promise<rntme.contracts.ai_llm.v1.ThreadRun>;

                    /**
                     * Calls SubmitJob.
                     * @param request SubmitJobRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AsyncJob
                     */
                    public submitJob(request: rntme.contracts.ai_llm.v1.ISubmitJobRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.SubmitJobCallback): void;

                    /**
                     * Calls SubmitJob.
                     * @param request SubmitJobRequest message or plain object
                     * @returns Promise
                     */
                    public submitJob(request: rntme.contracts.ai_llm.v1.ISubmitJobRequest): Promise<rntme.contracts.ai_llm.v1.AsyncJob>;

                    /**
                     * Calls GetJob.
                     * @param request GetJobRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AsyncJob
                     */
                    public getJob(request: rntme.contracts.ai_llm.v1.IGetJobRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.GetJobCallback): void;

                    /**
                     * Calls GetJob.
                     * @param request GetJobRequest message or plain object
                     * @returns Promise
                     */
                    public getJob(request: rntme.contracts.ai_llm.v1.IGetJobRequest): Promise<rntme.contracts.ai_llm.v1.AsyncJob>;

                    /**
                     * Calls CancelJob.
                     * @param request CancelJobRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AsyncJob
                     */
                    public cancelJob(request: rntme.contracts.ai_llm.v1.ICancelJobRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.CancelJobCallback): void;

                    /**
                     * Calls CancelJob.
                     * @param request CancelJobRequest message or plain object
                     * @returns Promise
                     */
                    public cancelJob(request: rntme.contracts.ai_llm.v1.ICancelJobRequest): Promise<rntme.contracts.ai_llm.v1.AsyncJob>;

                    /**
                     * Calls ListJobs.
                     * @param request ListJobsRequest message or plain object
                     * @param callback Node-style callback called with the error, if any, and AsyncJobList
                     */
                    public listJobs(request: rntme.contracts.ai_llm.v1.IListJobsRequest, callback: rntme.contracts.ai_llm.v1.AiLlmModule.ListJobsCallback): void;

                    /**
                     * Calls ListJobs.
                     * @param request ListJobsRequest message or plain object
                     * @returns Promise
                     */
                    public listJobs(request: rntme.contracts.ai_llm.v1.IListJobsRequest): Promise<rntme.contracts.ai_llm.v1.AsyncJobList>;
                }

                namespace AiLlmModule {

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#complete}.
                     * @param error Error, if any
                     * @param [response] Completion
                     */
                    type CompleteCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.Completion) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#getCompletion}.
                     * @param error Error, if any
                     * @param [response] Completion
                     */
                    type GetCompletionCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.Completion) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#createThread}.
                     * @param error Error, if any
                     * @param [response] AssistantThread
                     */
                    type CreateThreadCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.AssistantThread) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#getThread}.
                     * @param error Error, if any
                     * @param [response] AssistantThread
                     */
                    type GetThreadCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.AssistantThread) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#deleteThread}.
                     * @param error Error, if any
                     * @param [response] AssistantThread
                     */
                    type DeleteThreadCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.AssistantThread) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#addMessage}.
                     * @param error Error, if any
                     * @param [response] ThreadItem
                     */
                    type AddMessageCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.ThreadItem) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#listThreadItems}.
                     * @param error Error, if any
                     * @param [response] ThreadItemList
                     */
                    type ListThreadItemsCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.ThreadItemList) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#runThread}.
                     * @param error Error, if any
                     * @param [response] ThreadRun
                     */
                    type RunThreadCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.ThreadRun) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#getThreadRun}.
                     * @param error Error, if any
                     * @param [response] ThreadRun
                     */
                    type GetThreadRunCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.ThreadRun) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#cancelThreadRun}.
                     * @param error Error, if any
                     * @param [response] ThreadRun
                     */
                    type CancelThreadRunCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.ThreadRun) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#submitJob}.
                     * @param error Error, if any
                     * @param [response] AsyncJob
                     */
                    type SubmitJobCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.AsyncJob) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#getJob}.
                     * @param error Error, if any
                     * @param [response] AsyncJob
                     */
                    type GetJobCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.AsyncJob) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#cancelJob}.
                     * @param error Error, if any
                     * @param [response] AsyncJob
                     */
                    type CancelJobCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.AsyncJob) => void;

                    /**
                     * Callback as used by {@link rntme.contracts.ai_llm.v1.AiLlmModule#listJobs}.
                     * @param error Error, if any
                     * @param [response] AsyncJobList
                     */
                    type ListJobsCallback = (error: (Error|null), response?: rntme.contracts.ai_llm.v1.AsyncJobList) => void;
                }

                /** Properties of a CreateCompletionRequest. */
                interface ICreateCompletionRequest {

                    /** CreateCompletionRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateCompletionRequest model */
                    model?: (string|null);

                    /** CreateCompletionRequest messages */
                    messages?: (rntme.contracts.ai_llm.v1.IMessage[]|null);

                    /** CreateCompletionRequest tools */
                    tools?: (rntme.contracts.ai_llm.v1.IToolDefinition[]|null);

                    /** CreateCompletionRequest tool_choice */
                    tool_choice?: (string|null);

                    /** CreateCompletionRequest sampling */
                    sampling?: (rntme.contracts.ai_llm.v1.ISamplingParams|null);

                    /** CreateCompletionRequest reasoning_effort */
                    reasoning_effort?: (rntme.contracts.ai_llm.v1.ReasoningEffort|null);

                    /** CreateCompletionRequest reasoning_visibility */
                    reasoning_visibility?: (rntme.contracts.ai_llm.v1.ReasoningVisibility|null);

                    /** CreateCompletionRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents a CreateCompletionRequest. */
                class CreateCompletionRequest implements ICreateCompletionRequest {

                    /**
                     * Constructs a new CreateCompletionRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ICreateCompletionRequest);

                    /** CreateCompletionRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateCompletionRequest model. */
                    public model: string;

                    /** CreateCompletionRequest messages. */
                    public messages: rntme.contracts.ai_llm.v1.IMessage[];

                    /** CreateCompletionRequest tools. */
                    public tools: rntme.contracts.ai_llm.v1.IToolDefinition[];

                    /** CreateCompletionRequest tool_choice. */
                    public tool_choice: string;

                    /** CreateCompletionRequest sampling. */
                    public sampling?: (rntme.contracts.ai_llm.v1.ISamplingParams|null);

                    /** CreateCompletionRequest reasoning_effort. */
                    public reasoning_effort: rntme.contracts.ai_llm.v1.ReasoningEffort;

                    /** CreateCompletionRequest reasoning_visibility. */
                    public reasoning_visibility: rntme.contracts.ai_llm.v1.ReasoningVisibility;

                    /** CreateCompletionRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new CreateCompletionRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateCompletionRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ICreateCompletionRequest): rntme.contracts.ai_llm.v1.CreateCompletionRequest;

                    /**
                     * Encodes the specified CreateCompletionRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.CreateCompletionRequest.verify|verify} messages.
                     * @param message CreateCompletionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ICreateCompletionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateCompletionRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.CreateCompletionRequest.verify|verify} messages.
                     * @param message CreateCompletionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ICreateCompletionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateCompletionRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateCompletionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.CreateCompletionRequest;

                    /**
                     * Decodes a CreateCompletionRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateCompletionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.CreateCompletionRequest;

                    /**
                     * Verifies a CreateCompletionRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateCompletionRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateCompletionRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.CreateCompletionRequest;

                    /**
                     * Creates a plain object from a CreateCompletionRequest message. Also converts values to other types if specified.
                     * @param message CreateCompletionRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.CreateCompletionRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateCompletionRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateCompletionRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetCompletionRequest. */
                interface IGetCompletionRequest {

                    /** GetCompletionRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetCompletionRequest. */
                class GetCompletionRequest implements IGetCompletionRequest {

                    /**
                     * Constructs a new GetCompletionRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IGetCompletionRequest);

                    /** GetCompletionRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetCompletionRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetCompletionRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IGetCompletionRequest): rntme.contracts.ai_llm.v1.GetCompletionRequest;

                    /**
                     * Encodes the specified GetCompletionRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.GetCompletionRequest.verify|verify} messages.
                     * @param message GetCompletionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IGetCompletionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetCompletionRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.GetCompletionRequest.verify|verify} messages.
                     * @param message GetCompletionRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IGetCompletionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetCompletionRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetCompletionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.GetCompletionRequest;

                    /**
                     * Decodes a GetCompletionRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetCompletionRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.GetCompletionRequest;

                    /**
                     * Verifies a GetCompletionRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetCompletionRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetCompletionRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.GetCompletionRequest;

                    /**
                     * Creates a plain object from a GetCompletionRequest message. Also converts values to other types if specified.
                     * @param message GetCompletionRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.GetCompletionRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetCompletionRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetCompletionRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CreateThreadRequest. */
                interface ICreateThreadRequest {

                    /** CreateThreadRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateThreadRequest title */
                    title?: (string|null);

                    /** CreateThreadRequest initial_messages */
                    initial_messages?: (rntme.contracts.ai_llm.v1.IMessage[]|null);

                    /** CreateThreadRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents a CreateThreadRequest. */
                class CreateThreadRequest implements ICreateThreadRequest {

                    /**
                     * Constructs a new CreateThreadRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ICreateThreadRequest);

                    /** CreateThreadRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CreateThreadRequest title. */
                    public title: string;

                    /** CreateThreadRequest initial_messages. */
                    public initial_messages: rntme.contracts.ai_llm.v1.IMessage[];

                    /** CreateThreadRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /**
                     * Creates a new CreateThreadRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CreateThreadRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ICreateThreadRequest): rntme.contracts.ai_llm.v1.CreateThreadRequest;

                    /**
                     * Encodes the specified CreateThreadRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.CreateThreadRequest.verify|verify} messages.
                     * @param message CreateThreadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ICreateThreadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CreateThreadRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.CreateThreadRequest.verify|verify} messages.
                     * @param message CreateThreadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ICreateThreadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CreateThreadRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CreateThreadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.CreateThreadRequest;

                    /**
                     * Decodes a CreateThreadRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CreateThreadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.CreateThreadRequest;

                    /**
                     * Verifies a CreateThreadRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CreateThreadRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CreateThreadRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.CreateThreadRequest;

                    /**
                     * Creates a plain object from a CreateThreadRequest message. Also converts values to other types if specified.
                     * @param message CreateThreadRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.CreateThreadRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CreateThreadRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CreateThreadRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetThreadRequest. */
                interface IGetThreadRequest {

                    /** GetThreadRequest canonical_id */
                    canonical_id?: (string|null);
                }

                /** Represents a GetThreadRequest. */
                class GetThreadRequest implements IGetThreadRequest {

                    /**
                     * Constructs a new GetThreadRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IGetThreadRequest);

                    /** GetThreadRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetThreadRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetThreadRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IGetThreadRequest): rntme.contracts.ai_llm.v1.GetThreadRequest;

                    /**
                     * Encodes the specified GetThreadRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.GetThreadRequest.verify|verify} messages.
                     * @param message GetThreadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IGetThreadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetThreadRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.GetThreadRequest.verify|verify} messages.
                     * @param message GetThreadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IGetThreadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetThreadRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetThreadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.GetThreadRequest;

                    /**
                     * Decodes a GetThreadRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetThreadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.GetThreadRequest;

                    /**
                     * Verifies a GetThreadRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetThreadRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetThreadRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.GetThreadRequest;

                    /**
                     * Creates a plain object from a GetThreadRequest message. Also converts values to other types if specified.
                     * @param message GetThreadRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.GetThreadRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetThreadRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetThreadRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DeleteThreadRequest. */
                interface IDeleteThreadRequest {

                    /** DeleteThreadRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteThreadRequest canonical_id */
                    canonical_id?: (string|null);

                    /** DeleteThreadRequest hard_delete */
                    hard_delete?: (boolean|null);
                }

                /** Represents a DeleteThreadRequest. */
                class DeleteThreadRequest implements IDeleteThreadRequest {

                    /**
                     * Constructs a new DeleteThreadRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IDeleteThreadRequest);

                    /** DeleteThreadRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** DeleteThreadRequest canonical_id. */
                    public canonical_id: string;

                    /** DeleteThreadRequest hard_delete. */
                    public hard_delete: boolean;

                    /**
                     * Creates a new DeleteThreadRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DeleteThreadRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IDeleteThreadRequest): rntme.contracts.ai_llm.v1.DeleteThreadRequest;

                    /**
                     * Encodes the specified DeleteThreadRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.DeleteThreadRequest.verify|verify} messages.
                     * @param message DeleteThreadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IDeleteThreadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DeleteThreadRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.DeleteThreadRequest.verify|verify} messages.
                     * @param message DeleteThreadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IDeleteThreadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DeleteThreadRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DeleteThreadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.DeleteThreadRequest;

                    /**
                     * Decodes a DeleteThreadRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DeleteThreadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.DeleteThreadRequest;

                    /**
                     * Verifies a DeleteThreadRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DeleteThreadRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DeleteThreadRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.DeleteThreadRequest;

                    /**
                     * Creates a plain object from a DeleteThreadRequest message. Also converts values to other types if specified.
                     * @param message DeleteThreadRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.DeleteThreadRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DeleteThreadRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DeleteThreadRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AddMessageRequest. */
                interface IAddMessageRequest {

                    /** AddMessageRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** AddMessageRequest thread_id */
                    thread_id?: (string|null);

                    /** AddMessageRequest message */
                    message?: (rntme.contracts.ai_llm.v1.IMessage|null);
                }

                /** Represents an AddMessageRequest. */
                class AddMessageRequest implements IAddMessageRequest {

                    /**
                     * Constructs a new AddMessageRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAddMessageRequest);

                    /** AddMessageRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** AddMessageRequest thread_id. */
                    public thread_id: string;

                    /** AddMessageRequest message. */
                    public message?: (rntme.contracts.ai_llm.v1.IMessage|null);

                    /**
                     * Creates a new AddMessageRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AddMessageRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAddMessageRequest): rntme.contracts.ai_llm.v1.AddMessageRequest;

                    /**
                     * Encodes the specified AddMessageRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AddMessageRequest.verify|verify} messages.
                     * @param message AddMessageRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAddMessageRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AddMessageRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AddMessageRequest.verify|verify} messages.
                     * @param message AddMessageRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAddMessageRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AddMessageRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AddMessageRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AddMessageRequest;

                    /**
                     * Decodes an AddMessageRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AddMessageRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AddMessageRequest;

                    /**
                     * Verifies an AddMessageRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AddMessageRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AddMessageRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AddMessageRequest;

                    /**
                     * Creates a plain object from an AddMessageRequest message. Also converts values to other types if specified.
                     * @param message AddMessageRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AddMessageRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AddMessageRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AddMessageRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ListThreadItemsRequest. */
                interface IListThreadItemsRequest {

                    /** ListThreadItemsRequest base */
                    base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListThreadItemsRequest thread_id */
                    thread_id?: (string|null);

                    /** ListThreadItemsRequest after_item_id */
                    after_item_id?: (string|null);
                }

                /** Represents a ListThreadItemsRequest. */
                class ListThreadItemsRequest implements IListThreadItemsRequest {

                    /**
                     * Constructs a new ListThreadItemsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IListThreadItemsRequest);

                    /** ListThreadItemsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListThreadItemsRequest thread_id. */
                    public thread_id: string;

                    /** ListThreadItemsRequest after_item_id. */
                    public after_item_id: string;

                    /**
                     * Creates a new ListThreadItemsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListThreadItemsRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IListThreadItemsRequest): rntme.contracts.ai_llm.v1.ListThreadItemsRequest;

                    /**
                     * Encodes the specified ListThreadItemsRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ListThreadItemsRequest.verify|verify} messages.
                     * @param message ListThreadItemsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IListThreadItemsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListThreadItemsRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ListThreadItemsRequest.verify|verify} messages.
                     * @param message ListThreadItemsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IListThreadItemsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListThreadItemsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListThreadItemsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ListThreadItemsRequest;

                    /**
                     * Decodes a ListThreadItemsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListThreadItemsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ListThreadItemsRequest;

                    /**
                     * Verifies a ListThreadItemsRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ListThreadItemsRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ListThreadItemsRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ListThreadItemsRequest;

                    /**
                     * Creates a plain object from a ListThreadItemsRequest message. Also converts values to other types if specified.
                     * @param message ListThreadItemsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ListThreadItemsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ListThreadItemsRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ListThreadItemsRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThreadItemList. */
                interface IThreadItemList {

                    /** ThreadItemList items */
                    items?: (rntme.contracts.ai_llm.v1.IThreadItem[]|null);

                    /** ThreadItemList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents a ThreadItemList. */
                class ThreadItemList implements IThreadItemList {

                    /**
                     * Constructs a new ThreadItemList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IThreadItemList);

                    /** ThreadItemList items. */
                    public items: rntme.contracts.ai_llm.v1.IThreadItem[];

                    /** ThreadItemList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new ThreadItemList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThreadItemList instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IThreadItemList): rntme.contracts.ai_llm.v1.ThreadItemList;

                    /**
                     * Encodes the specified ThreadItemList message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadItemList.verify|verify} messages.
                     * @param message ThreadItemList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IThreadItemList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThreadItemList message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ThreadItemList.verify|verify} messages.
                     * @param message ThreadItemList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IThreadItemList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThreadItemList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThreadItemList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ThreadItemList;

                    /**
                     * Decodes a ThreadItemList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThreadItemList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ThreadItemList;

                    /**
                     * Verifies a ThreadItemList message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThreadItemList message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThreadItemList
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ThreadItemList;

                    /**
                     * Creates a plain object from a ThreadItemList message. Also converts values to other types if specified.
                     * @param message ThreadItemList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ThreadItemList, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThreadItemList to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThreadItemList
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a RunThreadRequest. */
                interface IRunThreadRequest {

                    /** RunThreadRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** RunThreadRequest thread_id */
                    thread_id?: (string|null);

                    /** RunThreadRequest model */
                    model?: (string|null);

                    /** RunThreadRequest tools */
                    tools?: (rntme.contracts.ai_llm.v1.IToolDefinition[]|null);

                    /** RunThreadRequest tool_choice */
                    tool_choice?: (string|null);

                    /** RunThreadRequest sampling */
                    sampling?: (rntme.contracts.ai_llm.v1.ISamplingParams|null);

                    /** RunThreadRequest reasoning_effort */
                    reasoning_effort?: (rntme.contracts.ai_llm.v1.ReasoningEffort|null);

                    /** RunThreadRequest reasoning_visibility */
                    reasoning_visibility?: (rntme.contracts.ai_llm.v1.ReasoningVisibility|null);
                }

                /** Represents a RunThreadRequest. */
                class RunThreadRequest implements IRunThreadRequest {

                    /**
                     * Constructs a new RunThreadRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IRunThreadRequest);

                    /** RunThreadRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** RunThreadRequest thread_id. */
                    public thread_id: string;

                    /** RunThreadRequest model. */
                    public model: string;

                    /** RunThreadRequest tools. */
                    public tools: rntme.contracts.ai_llm.v1.IToolDefinition[];

                    /** RunThreadRequest tool_choice. */
                    public tool_choice: string;

                    /** RunThreadRequest sampling. */
                    public sampling?: (rntme.contracts.ai_llm.v1.ISamplingParams|null);

                    /** RunThreadRequest reasoning_effort. */
                    public reasoning_effort: rntme.contracts.ai_llm.v1.ReasoningEffort;

                    /** RunThreadRequest reasoning_visibility. */
                    public reasoning_visibility: rntme.contracts.ai_llm.v1.ReasoningVisibility;

                    /**
                     * Creates a new RunThreadRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns RunThreadRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IRunThreadRequest): rntme.contracts.ai_llm.v1.RunThreadRequest;

                    /**
                     * Encodes the specified RunThreadRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.RunThreadRequest.verify|verify} messages.
                     * @param message RunThreadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IRunThreadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified RunThreadRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.RunThreadRequest.verify|verify} messages.
                     * @param message RunThreadRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IRunThreadRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a RunThreadRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns RunThreadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.RunThreadRequest;

                    /**
                     * Decodes a RunThreadRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns RunThreadRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.RunThreadRequest;

                    /**
                     * Verifies a RunThreadRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a RunThreadRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns RunThreadRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.RunThreadRequest;

                    /**
                     * Creates a plain object from a RunThreadRequest message. Also converts values to other types if specified.
                     * @param message RunThreadRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.RunThreadRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this RunThreadRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for RunThreadRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a GetThreadRunRequest. */
                interface IGetThreadRunRequest {

                    /** GetThreadRunRequest thread_id */
                    thread_id?: (string|null);

                    /** GetThreadRunRequest run_id */
                    run_id?: (string|null);
                }

                /** Represents a GetThreadRunRequest. */
                class GetThreadRunRequest implements IGetThreadRunRequest {

                    /**
                     * Constructs a new GetThreadRunRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IGetThreadRunRequest);

                    /** GetThreadRunRequest thread_id. */
                    public thread_id: string;

                    /** GetThreadRunRequest run_id. */
                    public run_id: string;

                    /**
                     * Creates a new GetThreadRunRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetThreadRunRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IGetThreadRunRequest): rntme.contracts.ai_llm.v1.GetThreadRunRequest;

                    /**
                     * Encodes the specified GetThreadRunRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.GetThreadRunRequest.verify|verify} messages.
                     * @param message GetThreadRunRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IGetThreadRunRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetThreadRunRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.GetThreadRunRequest.verify|verify} messages.
                     * @param message GetThreadRunRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IGetThreadRunRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetThreadRunRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetThreadRunRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.GetThreadRunRequest;

                    /**
                     * Decodes a GetThreadRunRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetThreadRunRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.GetThreadRunRequest;

                    /**
                     * Verifies a GetThreadRunRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a GetThreadRunRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns GetThreadRunRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.GetThreadRunRequest;

                    /**
                     * Creates a plain object from a GetThreadRunRequest message. Also converts values to other types if specified.
                     * @param message GetThreadRunRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.GetThreadRunRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this GetThreadRunRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for GetThreadRunRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CancelThreadRunRequest. */
                interface ICancelThreadRunRequest {

                    /** CancelThreadRunRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CancelThreadRunRequest thread_id */
                    thread_id?: (string|null);

                    /** CancelThreadRunRequest run_id */
                    run_id?: (string|null);

                    /** CancelThreadRunRequest reason */
                    reason?: (string|null);
                }

                /** Represents a CancelThreadRunRequest. */
                class CancelThreadRunRequest implements ICancelThreadRunRequest {

                    /**
                     * Constructs a new CancelThreadRunRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ICancelThreadRunRequest);

                    /** CancelThreadRunRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CancelThreadRunRequest thread_id. */
                    public thread_id: string;

                    /** CancelThreadRunRequest run_id. */
                    public run_id: string;

                    /** CancelThreadRunRequest reason. */
                    public reason: string;

                    /**
                     * Creates a new CancelThreadRunRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CancelThreadRunRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ICancelThreadRunRequest): rntme.contracts.ai_llm.v1.CancelThreadRunRequest;

                    /**
                     * Encodes the specified CancelThreadRunRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.CancelThreadRunRequest.verify|verify} messages.
                     * @param message CancelThreadRunRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ICancelThreadRunRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CancelThreadRunRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.CancelThreadRunRequest.verify|verify} messages.
                     * @param message CancelThreadRunRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ICancelThreadRunRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CancelThreadRunRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CancelThreadRunRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.CancelThreadRunRequest;

                    /**
                     * Decodes a CancelThreadRunRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CancelThreadRunRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.CancelThreadRunRequest;

                    /**
                     * Verifies a CancelThreadRunRequest message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CancelThreadRunRequest message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CancelThreadRunRequest
                     */
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.CancelThreadRunRequest;

                    /**
                     * Creates a plain object from a CancelThreadRunRequest message. Also converts values to other types if specified.
                     * @param message CancelThreadRunRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.CancelThreadRunRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CancelThreadRunRequest to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CancelThreadRunRequest
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SubmitJobRequest. */
                interface ISubmitJobRequest {

                    /** SubmitJobRequest context */
                    context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** SubmitJobRequest batch_completion */
                    batch_completion?: (rntme.contracts.ai_llm.v1.IBatchCompletionPayload|null);

                    /** SubmitJobRequest ttl */
                    ttl?: (google.protobuf.IDuration|null);

                    /** SubmitJobRequest metadata */
                    metadata?: (rntme.contracts.common.v1.IMetadata|null);
                }

                /** Represents a SubmitJobRequest. */
                class SubmitJobRequest implements ISubmitJobRequest {

                    /**
                     * Constructs a new SubmitJobRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.ISubmitJobRequest);

                    /** SubmitJobRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** SubmitJobRequest batch_completion. */
                    public batch_completion?: (rntme.contracts.ai_llm.v1.IBatchCompletionPayload|null);

                    /** SubmitJobRequest ttl. */
                    public ttl?: (google.protobuf.IDuration|null);

                    /** SubmitJobRequest metadata. */
                    public metadata?: (rntme.contracts.common.v1.IMetadata|null);

                    /** SubmitJobRequest body. */
                    public body?: "batch_completion";

                    /**
                     * Creates a new SubmitJobRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SubmitJobRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ISubmitJobRequest): rntme.contracts.ai_llm.v1.SubmitJobRequest;

                    /**
                     * Encodes the specified SubmitJobRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.SubmitJobRequest.verify|verify} messages.
                     * @param message SubmitJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ISubmitJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SubmitJobRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.SubmitJobRequest.verify|verify} messages.
                     * @param message SubmitJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ISubmitJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SubmitJobRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SubmitJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.SubmitJobRequest;

                    /**
                     * Decodes a SubmitJobRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SubmitJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.SubmitJobRequest;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.SubmitJobRequest;

                    /**
                     * Creates a plain object from a SubmitJobRequest message. Also converts values to other types if specified.
                     * @param message SubmitJobRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.SubmitJobRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
                    constructor(properties?: rntme.contracts.ai_llm.v1.IGetJobRequest);

                    /** GetJobRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new GetJobRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns GetJobRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IGetJobRequest): rntme.contracts.ai_llm.v1.GetJobRequest;

                    /**
                     * Encodes the specified GetJobRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.GetJobRequest.verify|verify} messages.
                     * @param message GetJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IGetJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified GetJobRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.GetJobRequest.verify|verify} messages.
                     * @param message GetJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IGetJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a GetJobRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns GetJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.GetJobRequest;

                    /**
                     * Decodes a GetJobRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns GetJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.GetJobRequest;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.GetJobRequest;

                    /**
                     * Creates a plain object from a GetJobRequest message. Also converts values to other types if specified.
                     * @param message GetJobRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.GetJobRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
                    constructor(properties?: rntme.contracts.ai_llm.v1.ICancelJobRequest);

                    /** CancelJobRequest context. */
                    public context?: (rntme.contracts.common.v1.ICommandContext|null);

                    /** CancelJobRequest canonical_id. */
                    public canonical_id: string;

                    /**
                     * Creates a new CancelJobRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CancelJobRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.ICancelJobRequest): rntme.contracts.ai_llm.v1.CancelJobRequest;

                    /**
                     * Encodes the specified CancelJobRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.CancelJobRequest.verify|verify} messages.
                     * @param message CancelJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.ICancelJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CancelJobRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.CancelJobRequest.verify|verify} messages.
                     * @param message CancelJobRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.ICancelJobRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CancelJobRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CancelJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.CancelJobRequest;

                    /**
                     * Decodes a CancelJobRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CancelJobRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.CancelJobRequest;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.CancelJobRequest;

                    /**
                     * Creates a plain object from a CancelJobRequest message. Also converts values to other types if specified.
                     * @param message CancelJobRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.CancelJobRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
                    type?: (rntme.contracts.ai_llm.v1.AsyncJobType|null);

                    /** ListJobsRequest status */
                    status?: (rntme.contracts.ai_llm.v1.AsyncJobStatus|null);
                }

                /** Represents a ListJobsRequest. */
                class ListJobsRequest implements IListJobsRequest {

                    /**
                     * Constructs a new ListJobsRequest.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IListJobsRequest);

                    /** ListJobsRequest base. */
                    public base?: (rntme.contracts.common.v1.IListRequest|null);

                    /** ListJobsRequest type. */
                    public type: rntme.contracts.ai_llm.v1.AsyncJobType;

                    /** ListJobsRequest status. */
                    public status: rntme.contracts.ai_llm.v1.AsyncJobStatus;

                    /**
                     * Creates a new ListJobsRequest instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ListJobsRequest instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IListJobsRequest): rntme.contracts.ai_llm.v1.ListJobsRequest;

                    /**
                     * Encodes the specified ListJobsRequest message. Does not implicitly {@link rntme.contracts.ai_llm.v1.ListJobsRequest.verify|verify} messages.
                     * @param message ListJobsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IListJobsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ListJobsRequest message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.ListJobsRequest.verify|verify} messages.
                     * @param message ListJobsRequest message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IListJobsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ListJobsRequest message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ListJobsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.ListJobsRequest;

                    /**
                     * Decodes a ListJobsRequest message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ListJobsRequest
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.ListJobsRequest;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.ListJobsRequest;

                    /**
                     * Creates a plain object from a ListJobsRequest message. Also converts values to other types if specified.
                     * @param message ListJobsRequest
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.ListJobsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
                    items?: (rntme.contracts.ai_llm.v1.IAsyncJob[]|null);

                    /** AsyncJobList meta */
                    meta?: (rntme.contracts.common.v1.IListResponseMeta|null);
                }

                /** Represents an AsyncJobList. */
                class AsyncJobList implements IAsyncJobList {

                    /**
                     * Constructs a new AsyncJobList.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: rntme.contracts.ai_llm.v1.IAsyncJobList);

                    /** AsyncJobList items. */
                    public items: rntme.contracts.ai_llm.v1.IAsyncJob[];

                    /** AsyncJobList meta. */
                    public meta?: (rntme.contracts.common.v1.IListResponseMeta|null);

                    /**
                     * Creates a new AsyncJobList instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AsyncJobList instance
                     */
                    public static create(properties?: rntme.contracts.ai_llm.v1.IAsyncJobList): rntme.contracts.ai_llm.v1.AsyncJobList;

                    /**
                     * Encodes the specified AsyncJobList message. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobList.verify|verify} messages.
                     * @param message AsyncJobList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: rntme.contracts.ai_llm.v1.IAsyncJobList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AsyncJobList message, length delimited. Does not implicitly {@link rntme.contracts.ai_llm.v1.AsyncJobList.verify|verify} messages.
                     * @param message AsyncJobList message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: rntme.contracts.ai_llm.v1.IAsyncJobList, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AsyncJobList message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AsyncJobList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): rntme.contracts.ai_llm.v1.AsyncJobList;

                    /**
                     * Decodes an AsyncJobList message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AsyncJobList
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): rntme.contracts.ai_llm.v1.AsyncJobList;

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
                    public static fromObject(object: { [k: string]: any }): rntme.contracts.ai_llm.v1.AsyncJobList;

                    /**
                     * Creates a plain object from an AsyncJobList message. Also converts values to other types if specified.
                     * @param message AsyncJobList
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: rntme.contracts.ai_llm.v1.AsyncJobList, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
