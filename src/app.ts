import { CosmosClient, ContainerDefinition, DatabaseDefinition, CosmosClientOptions } from "@azure/cosmos";
import { v4 as uuid } from "uuid";
import * as faker from "faker/locale/en_GB";
import Semaphore from "semaphore-async-await";

process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";

const colors = ["red", "yellow", "pink", "green", "orange", "purple", "blue"] as const;
type Color = typeof colors[number];

type DBEntry = {
    partitionKey: string;
    givenName: string;
    familyName: string;
    favoriteColor: Color;
    favoriteWords: string[];
}

const clientOptions: CosmosClientOptions = {
    endpoint: "https://localhost:8081/",
    key: "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
};
const client = new CosmosClient(clientOptions);;

const databaseDefinition: DatabaseDefinition = { id: "test database" };
const partitionKey = "partitionKey";
const collectionDefinition: ContainerDefinition = { id: "test collection", partitionKey: { paths: [`/${partitionKey}`] } };

const createDb = async () => {
    const { database } = await client.databases.createIfNotExists(databaseDefinition);
    const { container } = await database.containers.createIfNotExists(collectionDefinition);
    console.log("DB Created");
}

const getContainer = () => {
    const database = client.database(databaseDefinition.id);
    return database.container(collectionDefinition.id);
}

const clearContainer = async () => {
    const container = getContainer();
    await container.delete();
    console.log("Container deleted");
}

const populateDb = async () => {
    const numberToCreate = 100000;
    const container = getContainer();
    const semaphore = new Semaphore(100);
    const promises = new Array(numberToCreate).fill(null).map(async (v, i) => {
        await semaphore.acquire();
        await container.items.create<DBEntry>({
            partitionKey: uuid(),
            givenName: faker.name.firstName(),
            familyName: faker.name.lastName(),
            favoriteColor: faker.random.arrayElement(colors),
            favoriteWords: new Array(100).fill(null).map(i => faker.random.word())
        });
        semaphore.release();
        const count = i + 1;
        if (count % 100 === 0) {
            console.log(`${count} of ${numberToCreate}`);
        }
    });
    await Promise.all(promises);
    console.log("DB Populated");
}

const executeQuery = async (query: string, params: {}, logFirstResponse?: boolean) => {
    const container = getContainer();
    const iterator = container.items.query<DBEntry>({
        query,
        parameters: Object.keys(params).map(k => ({ name: k, value: params[k] }) )
    });
    const response = await iterator.fetchAll();
    console.log(`Query: ${query}`);
    console.log(`Returned: ${response.resources.length}`);
    console.log(`Cost: ${response.requestCharge} RUs`);
    if (logFirstResponse) {
        console.log(`Response: ${response.resources[0]}`);
    }
}

const queryCount = async () => {
    await executeQuery("SELECT VALUE COUNT(1) FROM c", {}, true);
}

const queryNames = async () => {
    await executeQuery("SELECT * FROM c WHERE c.givenName = @givenName", { "@givenName": "Thomas" });
    await executeQuery("SELECT * FROM c WHERE STARTSWITH(c.givenName, @givenName)", { "@givenName": "Thomas" });
    await executeQuery("SELECT * FROM c WHERE c.familyName = @familyName", { "@familyName": "Hyde" });
    await executeQuery("SELECT * FROM c WHERE c.givenName = 'Will' AND c.familyName = 'Green'", {});
}

const queryColors = async () => {
    const color: Color = "yellow";
    await executeQuery("SELECT * FROM c WHERE c.favoriteColor = @color", { "@color": color });
    await executeQuery("SELECT c.givenName FROM c WHERE c.favoriteColor = @color", { "@color": color });
    await executeQuery("SELECT VALUE COUNT(1) FROM c WHERE c.favoriteColor = @color", { "@color": color }, true);
    await executeQuery("SELECT TOP 10 * FROM c WHERE c.favoriteColor = @color", { "@color": color });
    await executeQuery("SELECT TOP 20 * FROM c WHERE c.favoriteColor = @color", { "@color": color });
    await executeQuery("SELECT TOP 100 * FROM c WHERE c.favoriteColor = @color", { "@color": color });
    await executeQuery("SELECT TOP 1000 * FROM c WHERE c.favoriteColor = @color", { "@color": color });
}

const queryWords = async () => {
    const word = "Chips";
    await executeQuery("SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(c.favoriteWords, @word)", { "@word": word }, true);
    await executeQuery("SELECT c.id FROM c WHERE ARRAY_CONTAINS(c.favoriteWords, @word)", { "@word": word });
    await executeQuery("SELECT TOP 10 c.id FROM c WHERE ARRAY_CONTAINS(c.favoriteWords, @word)", { "@word": word });
    await executeQuery("SELECT * FROM c WHERE ARRAY_CONTAINS(c.favoriteWords, 'Chips') AND ARRAY_CONTAINS(c.favoriteWords, 'Hat') AND ARRAY_CONTAINS(c.favoriteWords, 'Brunei Dollar')", {});
}

(async () => {
    console.log((await getContainer().read()).resource.indexingPolicy)
    // await clearContainer();
    // await createDb();
    // await populateDb();
    await queryCount();
    await queryNames();
    await queryColors();
    await queryWords();
})();
